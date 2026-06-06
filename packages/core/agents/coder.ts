import { AGENT_TYPES, AgentEvent, AgentPayload, Attachment, GapStatus } from '../lib/types/agent';
import { Message } from '../lib/types/llm';
import { sendOutboundMessage } from '../lib/outbound';
import { logger } from '../lib/logger';
import { Context } from 'aws-lambda';
import {
  extractPayload,
  detectFailure,
  isTaskPaused,
  validatePayload,
  extractBaseUserId,
  initAgent,
} from '../lib/utils/agent-helpers';
import { TRACE_TYPES } from '../lib/constants';

/**
 * Coder Agent handler. Processes coding tasks, implements changes,
 * and optionally triggers deployments or notifies QA.
 *
 * @param event - The EventBridge event.
 * @param context - The AWS Lambda context.
 * @returns A promise that resolves to the agent's response string, or undefined on error.
 */
export const handler = async (event: AgentEvent, context: Context): Promise<string | undefined> => {
  logger.info('Coder Agent received task:', JSON.stringify(event, null, 2));

  // EventBridge wraps the payload in 'detail'
  const payload = extractPayload<AgentPayload>(event);
  const {
    userId,
    task,
    metadata,
    traceId,
    sessionId,
    isContinuation,
    initiatorId,
    depth,
    taskId,
    workspaceId,
    teamId,
    staffId,
    userRole,
  } = payload;
  const gapIds = metadata?.gapIds as string[] | undefined;
  const applyStagedChanges = metadata?.applyStagedChanges as boolean | undefined;

  if (!validatePayload({ userId, task: task || '' }, ['userId', 'task'])) {
    return;
  }

  // 1. Prepare writable /tmp workspace
  const { createWorkspace, cleanupWorkspace } = await import('../lib/utils/workspace-manager');
  const workspacePath = await createWorkspace(
    traceId ?? `unknown-${Date.now()}`,
    applyStagedChanges
  );
  const originalCwd = process.cwd();
  process.chdir(workspacePath);
  logger.info(`[Coder] Working in workspace: ${workspacePath}`);

  try {
    const isAggregation = task?.includes('[AGGREGATED_RESULTS]');
    const skipSwarmDecomposition = !!gapIds?.length;

    // Swarm Self-Organization: Decompose high-level goals into parallel sub-tasks
    if (skipSwarmDecomposition) {
      logger.info('[CODER] Skipping swarm decomposition for gap-scoped evolution task.');
    } else {
      const { handleSwarmDecomposition } = await import('../lib/agent/swarm-orchestrator');
      const { wasDecomposed, response: swarmResponse } = await handleSwarmDecomposition(
        task || '',
        payload,
        {
          traceId,
          sessionId,
          depth,
          isAggregation,
          sourceAgentId: AGENT_TYPES.CODER,
          lockedGapIds: gapIds || [],
          barrierTimeoutMs: 30 * 60 * 1000, // 30 mins for complex coding tasks
          aggregationType: 'merge_patches',
          aggregationPrompt: `I have completed the parallel implementation for: "${task?.substring(0, 200)}...". 
                         Please merge the resulting patches and synthesize the final outcome.
                         Prepend the response with [AGGREGATED_RESULTS].`,
          minLength: 400,
        }
      );

      if (wasDecomposed) {
        logger.info(`[CODER] Development Goal successfully decomposed into swarm tasks.`);
        return (
          swarmResponse || `[DELEGATED] Task decomposed into parallel sub-tasks for execution.`
        );
      }
    }

    // 2. Discovery & Initialization
    const { config, memory } = await initAgent(AGENT_TYPES.CODER, { workspaceId });

    // 3. Gap Management - PROGRESS (Phase B2: Atomic Transitions)
    if (gapIds && gapIds.length > 0) {
      for (const gapId of gapIds) {
        const lockAcquired = await memory.acquireGapLock(gapId, AGENT_TYPES.CODER, undefined, {
          workspaceId,
        });
        if (lockAcquired) {
          try {
            const res = await memory.updateGapStatus(gapId, GapStatus.PROGRESS, { workspaceId });
            if (!res.success) {
              logger.warn(`[Coder] Failed to transition gap ${gapId} to PROGRESS: ${res.error}`);
            }
          } finally {
            await memory.releaseGapLock(gapId, AGENT_TYPES.CODER, undefined, undefined, {
              workspaceId,
            });
          }
        }
      }
    }

    // 4. Process the task via unified lifecycle (Session Locking + Heartbeat)
    const { processEventWithAgent } = await import('../handlers/events/shared');

    interface CoderParsedData {
      patch?: string;
      buildId?: string;
      data?: {
        patch?: string;
        buildId?: string;
      };
    }

    // Load specs from DDB to retrieve approved evolution contracts
    const specDetails: string[] = [];
    if (gapIds && gapIds.length > 0) {
      for (const gapId of gapIds) {
        try {
          const planStr = await memory.getDistilledMemory(`PLAN#${gapId}`, { workspaceId });
          if (planStr) {
            const parsedPlan = JSON.parse(planStr);
            if (parsedPlan.spec) {
              specDetails.push(`### Target Spec for Gap [${gapId}]:\n${parsedPlan.spec}`);
            }
          }
        } catch (e) {
          logger.warn(`[CODER] Failed to load spec for gap ${gapId}:`, e);
        }
      }
    }

    const specContext =
      specDetails.length > 0
        ? `\n\n[TARGET_TECHNICAL_SPECIFICATIONS]:\nThese are the user-approved EARS functional requirements and technical architecture/constraints that you MUST strictly implement. Do NOT deviate from this contract.\n${specDetails.join('\n\n')}`
        : '';

    const evolutionArtifactContext =
      gapIds && gapIds.length > 0
        ? `\n\n[EVOLUTION_OUTPUT_REQUIREMENTS]:\nThis is a gap-scoped autonomous evolution task. Your final structured JSON must include at least one concrete technical artifact under data.\n- Use data.patch with the git diff returned by generatePatch when you are delivering code changes without immediate deployment.\n- Use data.buildId with the deployment/build identifier returned by stageChanges or triggerDeployment when you are deploying directly.\nDo not return SUCCESS with an empty data object. If you made changes, include the artifact in data and summarize the action in message.`
        : '';

    const coderTask = `${task || ''}${specContext}${evolutionArtifactContext}`;

    // For autonomous evolution tasks (gap-based), auto-skip DoD pre-flight checks.
    // These tasks are dispatched by trusted planners; the recallKnowledge/verifyChanges
    // workflow adds friction without adding safety for targeted automated patches.
    if (gapIds && gapIds.length > 0) {
      process.env.CLAW_SKIP_TOOL_VALIDATION = 'true';
    }

    let result: {
      responseText: string;
      attachments: Message['attachments'];
      parsedData?: CoderParsedData;
    };
    try {
      const processResult = await processEventWithAgent(userId, AGENT_TYPES.CODER, coderTask, {
        context,
        traceId,
        taskId: taskId ?? traceId,
        sessionId,
        depth,
        initiatorId,
        isContinuation,
        workspaceId,
        teamId,
        staffId,
        userRole,
        metadata,
        attachments: metadata?.attachments as Attachment[],
        handlerTitle: 'Coder Agent',
        outboundHandlerName: AGENT_TYPES.CODER,
        formatResponse: (text) => text,
        maxTokens: 32000,
      });
      result = {
        ...processResult,
        parsedData: processResult.parsedData as CoderParsedData | undefined,
      };
    } catch (err) {
      logger.error('Unexpected error in Coder Agent processing:', err);
      result = {
        responseText: `SYSTEM_ERROR: ${err instanceof Error ? err.message : String(err)}`,
        attachments: [],
      };
    }

    let responseText = result.responseText;
    const isFailure = detectFailure(responseText);
    const parsed = result.parsedData;

    if (!result.parsedData?.patch && parsed?.data?.patch) {
      result.parsedData = {
        ...parsed,
        patch: parsed.data.patch,
      };
    }

    if (!result.parsedData?.buildId && parsed?.data?.buildId) {
      result.parsedData = {
        ...(result.parsedData || parsed),
        buildId: parsed.data.buildId,
      };
    }

    logger.debug(
      `[Coder] Post-process state: parsed.patch=${!!result.parsedData?.patch}, isFailure=${isFailure}, gapIds=${JSON.stringify(gapIds)}`
    );

    // Fallback: Extract patch from responseText if not in parsed data
    if (!result.parsedData?.patch) {
      logger.debug(
        `[Coder] Fallback 1: Attempting to extract patch from responseText (length=${responseText.length})`
      );
      const patchMatch = responseText.match(/PATCH_START\s*([\s\S]*?)\s*PATCH_END/);
      if (patchMatch?.[1]?.trim()) {
        logger.info(
          `[Coder] Fallback 1 SUCCESS: Extracted patch (${patchMatch[1].trim().length} chars)`
        );
        result.parsedData = {
          ...(result.parsedData || {}),
          patch: patchMatch[1].trim(),
        };
      } else {
        logger.debug('[Coder] Fallback 1 FAILED: No PATCH_START/END markers in responseText');
      }
    }

    // Fallback 2: If still no patch, try to recover from session history
    // This handles cases where generatePatch tool was called but result wasn't
    // included in the final LLM response text
    if (!result.parsedData?.patch && sessionId) {
      logger.debug(
        `[Coder] Fallback 2: Attempting to recover from session history (sessionId=${sessionId})`
      );
      try {
        const history = await memory.getHistory(sessionId, { workspaceId });
        logger.debug(`[Coder] Fallback 2: Retrieved history with ${history.length} messages`);

        // Find the last generatePatch tool result
        let foundGeneratePatch = false;
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i];
          if (msg.tool_calls?.some((tc) => tc.function?.name === 'generatePatch')) {
            foundGeneratePatch = true;
            logger.debug(`[Coder] Fallback 2: Found generatePatch tool_call at index ${i}`);
            // Check subsequent messages for tool results
            for (let j = i + 1; j < history.length; j++) {
              const nextMsg = history[j];
              if (nextMsg.content?.includes?.('PATCH_START')) {
                logger.debug(`[Coder] Fallback 2: Found PATCH_START at index ${j}`);
                const patchMatch = nextMsg.content.match(/PATCH_START\s*([\s\S]*?)\s*PATCH_END/);
                if (patchMatch?.[1]?.trim()) {
                  result.parsedData = {
                    ...(result.parsedData || {}),
                    patch: patchMatch[1].trim(),
                  };
                  logger.info(
                    `[Coder] Fallback 2 SUCCESS: Recovered patch from history (${patchMatch[1].trim().length} chars)`
                  );
                  break;
                }
              }
            }
            if (result.parsedData?.patch) break;
          }
        }
        if (!foundGeneratePatch) {
          logger.debug('[Coder] Fallback 2: generatePatch tool_call NOT found in history');
        }
        if (!result.parsedData?.patch) {
          logger.debug('[Coder] Fallback 2 FAILED: No patch recovered from history');
        }
      } catch (err) {
        logger.warn('[Coder] Fallback 2 ERROR: Failed to recover patch from history:', err);
      }
    }

    // Fallback 3: If the workspace still has local changes, generate a patch directly.
    if (!result.parsedData?.patch && gapIds && gapIds.length > 0) {
      logger.debug('[Coder] Fallback 3: Attempting direct patch generation from workspace');
      try {
        const { generatePatch } = await import('../tools/infra/deployment');
        const patchResult = await generatePatch.execute({
          sessionId: sessionId ?? traceId ?? `coder-${Date.now()}`,
          skipValidation: true,
        });
        const patchMatch = patchResult.match(/PATCH_START\s*([\s\S]*?)\s*PATCH_END/);
        if (patchMatch?.[1]?.trim()) {
          result.parsedData = {
            ...(result.parsedData || {}),
            patch: patchMatch[1].trim(),
          };
          logger.info(
            `[Coder] Fallback 3 SUCCESS: Generated patch from workspace (${patchMatch[1].trim().length} chars)`
          );
        } else {
          logger.debug(`[Coder] Fallback 3 FAILED: ${patchResult.slice(0, 160)}`);
        }
      } catch (err) {
        logger.warn('[Coder] Fallback 3 ERROR: Failed to generate patch from workspace:', err);
      }
    }

    const effectiveParsed = result.parsedData;
    const hasTechnicalArtifact = !!(effectiveParsed?.patch || effectiveParsed?.buildId);

    logger.info(
      `[Coder] Evolution validation state: effectiveParsed.patch=${!!effectiveParsed?.patch}, effectiveParsed.buildId=${!!effectiveParsed?.buildId}, gapIds=${gapIds?.length ?? 0}, isFailure=${isFailure}, isPaused=${isTaskPaused(responseText)}`
    );

    // 5. Evolution Validation & Auto-Deployment: Require a concrete technical artifact
    if (gapIds && gapIds.length > 0 && !isFailure && !isTaskPaused(responseText)) {
      if (!hasTechnicalArtifact) {
        logger.error(
          `[Coder] Evolution task successful but no technical artifact was returned. gapIds=${gapIds.join(', ')}`
        );
        responseText = `FAILED: Evolution task requires a technical artifact (patch or build) for gaps: ${gapIds.join(', ')}`;
      } else if (effectiveParsed?.patch && !effectiveParsed?.buildId) {
        // Auto-Deploy Fallback: Trigger deployment if patch exists but no buildId was returned
        logger.info('[Coder] Evolution task has patch but no build. Triggering auto-deployment...');
        try {
          const { triggerDeployment } = await import('../tools/infra/deployment');
          const deployResult = await triggerDeployment.execute({
            reason: `Autonomous evolution for gaps: ${gapIds.join(', ')}`,
            userId: extractBaseUserId(userId),
            traceId,
            initiatorId: AGENT_TYPES.CODER,
            sessionId,
            gapIds,
            patch: effectiveParsed.patch,
            workspaceId,
          });

          const buildMatch = deployResult.match(/Build ID: ([\w:-]+)/);
          if (buildMatch?.[1]) {
            effectiveParsed.buildId = buildMatch[1];
            logger.info(
              `[Coder] Auto-deployment triggered successfully. Build ID: ${effectiveParsed.buildId}`
            );
          } else {
            logger.warn(
              `[Coder] Auto-deployment triggered but no Build ID found in result: ${deployResult}`
            );
          }
        } catch (err) {
          logger.error('[Coder] Failed to trigger auto-deployment for evolution patch:', err);
        }
      } else {
        logger.info(
          `[Coder] Evolution validation PASSED: patch=${!!effectiveParsed?.patch}, buildId=${effectiveParsed?.buildId ?? 'none'}`
        );
      }
    }

    // 6. Gap Management - Final State (Phase B2: Atomic Transitions)
    if (gapIds && gapIds.length > 0) {
      const finalStatus =
        detectFailure(responseText) || isTaskPaused(responseText)
          ? GapStatus.OPEN
          : effectiveParsed?.buildId
            ? GapStatus.PROGRESS // Still in progress if building
            : GapStatus.DEPLOYED;

      for (const gapId of gapIds) {
        const lockAcquired = await memory.acquireGapLock(gapId, AGENT_TYPES.CODER, undefined, {
          workspaceId,
        });
        if (lockAcquired) {
          try {
            const res = await memory.updateGapStatus(gapId, finalStatus, { workspaceId });
            if (!res.success) {
              const step = finalStatus === GapStatus.OPEN ? 'reset' : 'transition';
              logger.warn(`[Gaps] Failed to ${step} gap ${gapId} to ${finalStatus}: ${res.error}`);
            }
          } finally {
            await memory.releaseGapLock(gapId, AGENT_TYPES.CODER, undefined, undefined, {
              workspaceId,
            });
          }
        }
      }
    }

    // 7. Final response and outbound message (Only if not already sent by shared handler)
    // Note: processEventWithAgent already calls sendOutboundMessage if response is not paused.
    // We only need to call it if we modified the responseText here (e.g. added FAILED prefix).
    if (responseText !== result.responseText && !isTaskPaused(responseText)) {
      const baseUserId = extractBaseUserId(userId);
      await sendOutboundMessage(
        AGENT_TYPES.CODER,
        userId,
        responseText,
        [baseUserId],
        sessionId,
        config.name,
        result.attachments
      );
    }

    // 8. Trace gap transitions if successful
    if (!detectFailure(responseText) && !isTaskPaused(responseText)) {
      const { addTraceStep } = await import('../lib/utils/trace-helper');
      await addTraceStep(traceId || 'unknown', 'root', {
        type: TRACE_TYPES.CODE_WRITTEN,
        content: {
          status: 'SUCCESS',
          responseSnippet: responseText.substring(0, 500),
        },
        metadata: { event: 'code_written' },
      });
    }

    // 9. Emit Task Result
    const { emitTaskEvent } = await import('../lib/utils/agent-helpers/event-emitter');
    await emitTaskEvent({
      source: `${AGENT_TYPES.CODER}.agent`,
      agentId: AGENT_TYPES.CODER,
      userId: extractBaseUserId(userId),
      task: task || '',
      response: responseText,
      traceId,
      taskId: payload.taskId,
      sessionId,
      initiatorId,
      depth,
      userRole,
      metadata: {
        patch: effectiveParsed?.patch,
        buildId: effectiveParsed?.buildId,
      },
    });

    return responseText;
  } finally {
    process.chdir(originalCwd);
    await cleanupWorkspace(workspacePath);
    delete process.env.CLAW_SKIP_TOOL_VALIDATION;
  }
};

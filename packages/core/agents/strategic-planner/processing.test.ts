import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_TYPES } from '../../lib/types/agent';
import { postProcessPlan } from './processing';

const mocks = vi.hoisted(() => ({
  sendOutboundMessage: vi.fn().mockResolvedValue(undefined),
  emitTaskEvent: vi.fn().mockResolvedValue(undefined),
  recordCooldown: vi.fn().mockResolvedValue(undefined),
  getEvolutionMode: vi.fn().mockResolvedValue('auto'),
  assignGapToTrack: vi.fn().mockResolvedValue(undefined),
  determineTrack: vi.fn().mockReturnValue('FEATURE'),
  addTraceStep: vi.fn().mockResolvedValue(undefined),
  decomposePlan: vi.fn().mockResolvedValue({ wasDecomposed: true, subTasks: [] }),
  dispatchTaskExecute: vi
    .fn()
    .mockResolvedValue(
      'TASK_PAUSED: I have successfully dispatched this task to the **coder** agent.'
    ),
}));

vi.mock('../../lib/outbound', () => ({
  sendOutboundMessage: mocks.sendOutboundMessage,
}));

vi.mock('../../lib/utils/agent-helpers', () => ({
  isTaskPaused: vi.fn((response: string) => response.startsWith('TASK_PAUSED')),
  extractBaseUserId: vi.fn((userId: string) => userId),
}));

vi.mock('../../lib/utils/agent-helpers/event-emitter', () => ({
  emitTaskEvent: mocks.emitTaskEvent,
}));

vi.mock('./evolution', () => ({
  recordCooldown: mocks.recordCooldown,
  getEvolutionMode: mocks.getEvolutionMode,
}));

vi.mock('../../lib/memory/gap-operations', () => ({
  assignGapToTrack: mocks.assignGapToTrack,
  determineTrack: mocks.determineTrack,
}));

vi.mock('../../lib/utils/trace-helper', () => ({
  addTraceStep: mocks.addTraceStep,
}));

vi.mock('../../lib/agent/decomposer', () => ({
  decomposePlan: mocks.decomposePlan,
}));

vi.mock('../../tools/knowledge/agent', () => ({
  dispatchTask: { execute: mocks.dispatchTaskExecute },
}));

describe('postProcessPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEvolutionMode.mockResolvedValue('auto');
    mocks.assignGapToTrack.mockResolvedValue(undefined);
    mocks.determineTrack.mockReturnValue('FEATURE');
    mocks.decomposePlan.mockResolvedValue({ wasDecomposed: true, subTasks: [] });
    mocks.dispatchTaskExecute.mockResolvedValue(
      'TASK_PAUSED: I have successfully dispatched this task to the **coder** agent.'
    );
  });

  it('dispatches the full plan directly for single-gap auto evolution', async () => {
    const plan =
      'Implement a minimal additive change to the existing GET /api/ping handler so the JSON response now includes service: "serverlessclaw" while preserving pong and ts exactly as they exist today. ' +
      'Limit the implementation to the current endpoint, avoid new abstractions, and keep the current response shape intact except for the added service field. ' +
      'Update the nearest targeted automated test so it asserts pong, ts, and service together, and do not introduce any unrelated refactors, deployment steps, or documentation churn. ' +
      'The expected outcome is one focused code patch that changes the live handler and one narrow verification assertion that proves the response now contains the new field without altering existing behavior.';

    const memory = {
      setGap: vi.fn().mockResolvedValue(undefined),
      updateDistilledMemory: vi.fn().mockResolvedValue(undefined),
      releaseGapLock: vi.fn().mockResolvedValue(undefined),
    } as any;

    await postProcessPlan(memory, {
      plan,
      planId: 'PLAN-123',
      status: 'SUCCESS',
      coveredGapIds: [],
      toolOptimizations: [],
      isFailure: false,
      userId: 'user-1',
      sessionId: 'session-1',
      traceId: 'trace-1',
      initiatorId: 'initiator-1',
      depth: 0,
      gapId: 'GAP#1001',
      task: 'Add service to /api/ping',
      isScheduledReview: false,
      config: { name: 'Planner' },
      metadata: {},
    });

    expect(mocks.decomposePlan).not.toHaveBeenCalled();
    expect(mocks.dispatchTaskExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_TYPES.CODER,
        userId: 'dashboard-user',
        task: plan,
        skipDecomposition: true,
        traceId: 'trace-1',
        sessionId: 'session-1',
        metadata: { gapIds: ['GAP#1001'] },
      })
    );
  });

  it('strips approval CTA text before dispatching an autonomous single-gap plan', async () => {
    const sanitizedPlan =
      'Executive summary\n- Mission: Add service to /api/ping while preserving pong and ts exactly as they exist today.\n\n' +
      'Strategic plan\n' +
      '1. Update the existing GET /api/ping handler to add service: "serverlessclaw" to the returned JSON object without changing HTTP status, pong, or ts behavior.\n' +
      '2. Update the nearest existing automated test so it asserts pong, ts, and service together.\n' +
      '3. Run the nearest package-local test command and keep the change scoped to the handler and test only.\n' +
      '4. Do not create new abstractions, do not touch deployment code, do not change formatting behavior, and do not modify unrelated files anywhere else in the repository.\n' +
      '5. Confirm the final diff is limited to the ping handler and the nearest automated test, and ensure the response still contains pong and ts exactly as before while adding service: "serverlessclaw" as a literal string.';
    const plan =
      `${sanitizedPlan}\n\nIf you approve this plan I will:\n` +
      '- (A) Create a Coder Agent task that implements the change.\n' +
      '- (B) Produce the exact patch here.\n\nWhich do you prefer?';

    const memory = {
      setGap: vi.fn().mockResolvedValue(undefined),
      updateDistilledMemory: vi.fn().mockResolvedValue(undefined),
      releaseGapLock: vi.fn().mockResolvedValue(undefined),
    } as any;

    await postProcessPlan(memory, {
      plan,
      planId: 'PLAN-456',
      status: 'SUCCESS',
      coveredGapIds: [],
      toolOptimizations: [],
      isFailure: false,
      userId: 'user-1',
      sessionId: 'session-1',
      traceId: 'trace-2',
      initiatorId: 'initiator-1',
      depth: 0,
      gapId: 'GAP#2002',
      task: 'Add service to /api/ping',
      isScheduledReview: false,
      config: { name: 'Planner' },
      metadata: {},
    });

    expect(mocks.dispatchTaskExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        task: sanitizedPlan,
      })
    );
    expect(memory.updateDistilledMemory).toHaveBeenCalledWith(
      'PLAN#GAP#2002',
      expect.stringContaining(JSON.stringify(sanitizedPlan).slice(1, -1))
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './coder';
import { AGENT_TYPES, GapStatus } from '../lib/types/agent';
import { initAgent } from '../lib/utils/agent-helpers';
import { emitTaskEvent } from '../lib/utils/agent-helpers/event-emitter';

import { processEventWithAgent } from '../handlers/events/shared';
vi.mock('../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/utils/agent-helpers/event-emitter', () => ({
  emitTaskEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/utils/trace-helper', () => ({
  addTraceStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/utils/workspace-manager', () => ({
  createWorkspace: vi.fn().mockResolvedValue('/tmp/mock-workspace'),
  cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../handlers/events/shared', () => ({
  processEventWithAgent: vi.fn().mockImplementation((...args) => {
    const options = args[3] as { handlerTitle?: string; taskId?: string };
    const responseText = 'Completed task';
    const parsedData = {
      status: 'SUCCESS',
      response: responseText,
      patch: options?.taskId === 'trace-patch' ? 'diff-content' : undefined,
    };
    return Promise.resolve({
      responseText,
      attachments: [],
      parsedData,
    });
  }),
}));

const mockHandleSwarmDecomposition = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ wasDecomposed: false, response: undefined })
);

const mockGeneratePatchExecute = vi.hoisted(() => vi.fn().mockResolvedValue('NO_CHANGES'));

vi.mock('../lib/agent/swarm-orchestrator', () => ({
  handleSwarmDecomposition: mockHandleSwarmDecomposition,
}));

vi.mock('../tools/infra/deployment', () => ({
  generatePatch: { execute: mockGeneratePatchExecute },
}));

const mockMemory = vi.hoisted(() => ({
  updateGapStatus: vi.fn().mockResolvedValue({ success: true }),
  acquireGapLock: vi.fn().mockResolvedValue(true),
  releaseGapLock: vi.fn().mockResolvedValue(undefined),
  getHistory: vi.fn().mockResolvedValue([]),
}));

const mockAgent = vi.hoisted(() => ({
  process: vi.fn().mockResolvedValue({
    responseText: JSON.stringify({ status: 'SUCCESS', response: 'Completed task' }),
    attachments: [],
  }),
}));

vi.mock('../lib/utils/agent-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/utils/agent-helpers')>();
  return {
    ...actual,
    initAgent: vi.fn().mockResolvedValue({
      config: { name: 'CoderAgent' },
      memory: mockMemory,
      agent: mockAgent,
    }),
  };
});

describe('Coder Agent', () => {
  const mockContext = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'chdir').mockImplementation(() => {});
    mockHandleSwarmDecomposition.mockResolvedValue({ wasDecomposed: false, response: undefined });
    mockGeneratePatchExecute.mockResolvedValue('NO_CHANGES');
  });

  it('should process a valid task and emit events', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed task',
      attachments: [],
      parsedData: { status: 'SUCCESS', response: 'Completed task' },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).toContain('Completed task');
    expect(processEventWithAgent).toHaveBeenCalled();
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_TYPES.CODER,
        userId: 'user123',
        task: 'implement feature',
        response: 'Completed task',
      })
    );
    expect(mockHandleSwarmDecomposition).toHaveBeenCalled();
  });

  it('should skip swarm decomposition for gap-scoped evolution tasks', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed task',
      attachments: [],
      parsedData: { status: 'SUCCESS', response: 'Completed task', patch: 'diff-content' },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    await handler(event, mockContext);

    expect(mockHandleSwarmDecomposition).not.toHaveBeenCalled();
    expect(processEventWithAgent).toHaveBeenCalled();
  });

  it('should append artifact requirements for gap-scoped evolution tasks', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Build started',
      attachments: [],
      parsedData: { status: 'SUCCESS', message: 'Build started', buildId: 'build-123' },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    await handler(event, mockContext);

    expect(processEventWithAgent).toHaveBeenCalledWith(
      'user123',
      AGENT_TYPES.CODER,
      expect.stringContaining('[EVOLUTION_OUTPUT_REQUIREMENTS]'),
      expect.any(Object)
    );
  });

  it('should forward userRole into shared processing and completion events', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed task',
      attachments: [],
      parsedData: { status: 'SUCCESS', response: 'Completed task' },
    });

    const event = {
      detail: {
        userId: 'user123',
        userRole: 'member',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
      },
    } as any;

    await handler(event, mockContext);

    expect(processEventWithAgent).toHaveBeenCalledWith(
      'user123',
      AGENT_TYPES.CODER,
      expect.any(String),
      expect.objectContaining({ userRole: 'member' })
    );

    expect(emitTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ userRole: 'member' }));
  });

  it('should pass patch metadata in emitTaskEvent when patch is present in response', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed with patch',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Completed with patch',
        patch: 'diff --git a/file.ts b/file.ts\n+new line',
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
      },
    } as any;

    await handler(event, mockContext);

    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_TYPES.CODER,
        userId: 'user123',
        response: 'Completed with patch',
        metadata: expect.objectContaining({
          patch: 'diff --git a/file.ts b/file.ts\n+new line',
        }),
      })
    );
  });

  it('should not include metadata when no patch is present', async () => {
    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        traceId: 'trace123',
        sessionId: 'session123',
        depth: 0,
      },
    } as any;

    await handler(event, mockContext);

    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_TYPES.CODER,
        metadata: {
          patch: undefined,
          buildId: undefined,
        },
      })
    );
  });

  it('should transition gaps to PROGRESS and DEPLOYED if no buildId', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Completed',
        patch: 'diff-1', // Required for evolution tasks now
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1', 'gap2'] },
      },
    } as any;

    await handler(event, mockContext);

    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.PROGRESS, expect.anything());
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap2', GapStatus.PROGRESS, expect.anything());
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap2', GapStatus.DEPLOYED, expect.anything());
  });

  it('should not update gap status to DEPLOYED if buildId is returned', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Building',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Building',
        buildId: 'build456',
        patch: 'diff-2', // Required for evolution tasks now
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    await handler(event, mockContext);

    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.PROGRESS, expect.anything());
    // Should NOT mark as DEPLOYED
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
  });

  it('should accept buildId-only evolution outputs as valid technical artifacts', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Building',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        message: 'Building',
        buildId: 'build456',
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).not.toContain('FAILED: Evolution task requires a technical artifact');
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.PROGRESS, expect.anything());
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          buildId: 'build456',
          patch: undefined,
        }),
      })
    );
  });
  it('should handle FAILED status correctly', async () => {
    const { processEventWithAgent } = await import('../handlers/events/shared');
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'FAILED: Compilation error',
      attachments: [],
      parsedData: { status: 'FAILED', response: 'FAILED: Compilation error' },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'fix bug',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    await handler(event, mockContext);

    // Should not mark as deployed
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
  });
  it('should ignore invalid payload missing task or userId', async () => {
    const event = {
      detail: {
        task: 'no user id',
      },
    } as any;

    const result = await handler(event, mockContext);
    expect(result).toBeUndefined();
    expect(initAgent).not.toHaveBeenCalled();
  });

  it('should mark as FAILED if evolution task (gapIds present) does not provide a technical artifact', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Implemented without patch',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Implemented without patch',
        // patch is missing
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).toContain('FAILED: Evolution task requires a technical artifact');
    // Ensure it doesn't mark as DEPLOYED
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
  });

  it('should extract patch from responseText when parsedData.patch is missing', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText:
        'Implemented changes.\nPATCH_START\ndiff --git a/packages/core/handlers/ping.ts b/packages/core/handlers/ping.ts\n+"X-Powered-By": "serverlessclaw"\nPATCH_END',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Implemented changes.',
        // patch intentionally missing to validate fallback extraction
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).not.toContain('FAILED: Evolution task requires a technical artifact');
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          patch: expect.stringContaining('diff --git a/packages/core/handlers/ping.ts'),
        }),
      })
    );
  });

  it('should accept patch artifacts nested under parsedData.data', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Completed with nested patch data',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        message: 'Completed with nested patch data',
        data: {
          patch: 'diff --git a/file.ts b/file.ts\n+new content',
        },
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).not.toContain('FAILED: Evolution task requires a technical artifact');
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          patch: expect.stringContaining('diff --git a/file.ts'),
        }),
      })
    );
  });

  it('should accept build artifacts nested under parsedData.data', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Build started',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        message: 'Build started',
        data: {
          patch: 'diff --git a/file.ts b/file.ts\n+new content',
          buildId: 'build-456',
        },
      },
    });

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    await handler(event, mockContext);

    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.PROGRESS, expect.anything());
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          buildId: 'build-456',
        }),
      })
    );
  });

  it('should recover patch from session history when tool was called but result not in response', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Changes completed successfully.',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Changes completed.',
        // patch intentionally missing
      },
    });

    // Mock session history with generatePatch tool call and result
    mockMemory.getHistory.mockResolvedValueOnce([
      {
        role: 'assistant',
        content: 'I will make the changes.',
        tool_calls: [
          {
            id: '1',
            function: { name: 'filesystem_write_file', arguments: '{}' },
          },
          {
            id: '2',
            function: { name: 'generatePatch', arguments: '{"sessionId":"test"}' },
          },
        ],
      },
      {
        role: 'user',
        content: 'Tool results',
      },
      {
        role: 'user',
        content:
          'PATCH_START\ndiff --git a/file.ts b/file.ts\n+new content\nPATCH_END\nPatch generated.',
      },
    ]);

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        sessionId: 'test-session',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).not.toContain('FAILED: Evolution task requires a technical artifact');
    expect(mockMemory.getHistory).toHaveBeenCalledWith('test-session');
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          patch: expect.stringContaining('diff --git a/file.ts'),
        }),
      })
    );
  });

  it('should generate a patch directly from the workspace when no artifact was returned', async () => {
    vi.mocked(processEventWithAgent).mockResolvedValueOnce({
      responseText: 'Changes completed successfully.',
      attachments: [],
      parsedData: {
        status: 'SUCCESS',
        response: 'Changes completed.',
      },
    });
    mockMemory.getHistory.mockResolvedValueOnce([]);
    mockGeneratePatchExecute.mockResolvedValueOnce(
      'PATCH_START\ndiff --git a/file.ts b/file.ts\n+new content\nPATCH_END'
    );

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        sessionId: 'test-session',
        traceId: 'trace123',
        metadata: { gapIds: ['gap1'] },
      },
    } as any;

    const result = await handler(event, mockContext);

    expect(result).not.toContain('FAILED: Evolution task requires a technical artifact');
    expect(mockGeneratePatchExecute).toHaveBeenCalledWith({
      sessionId: 'test-session',
      skipValidation: true,
    });
    expect(mockMemory.updateGapStatus).toHaveBeenCalledWith('gap1', GapStatus.DEPLOYED, expect.anything());
    expect(emitTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          patch: expect.stringContaining('diff --git a/file.ts'),
        }),
      })
    );
  });

  it('should NOT mark gaps as PROGRESS when initAgent fails (Bug 2 regression)', async () => {
    // Simulate initAgent throwing during initialization
    vi.mocked(initAgent).mockRejectedValueOnce(new Error('LLM provider unavailable'));

    const event = {
      detail: {
        userId: 'user123',
        task: 'implement feature',
        metadata: { gapIds: ['gap1', 'gap2'] },
      },
    } as any;

    // Handler may throw since initAgent failure is before try block — that's expected
    try {
      await handler(event, mockContext);
    } catch {
      // Expected: initAgent failure propagates since it's before the try block
    }

    // Gaps should NEVER have been transitioned to PROGRESS since
    // the transition now happens inside the try block (after initAgent)
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap1', GapStatus.PROGRESS, expect.anything());
    expect(mockMemory.updateGapStatus).not.toHaveBeenCalledWith('gap2', GapStatus.PROGRESS, expect.anything());
  });

  describe('Transition Failure Logging', () => {
    it('should log a warning if gap transition to PROGRESS fails', async () => {
      const { logger } = await import('../lib/logger');
      const spy = vi.spyOn(logger, 'warn');

      mockMemory.updateGapStatus.mockResolvedValue({
        success: false,
        error: 'Locked by another agent',
      });

      const event = {
        detail: {
          userId: 'user123',
          task: 'implement feature',
          metadata: { gapIds: ['gap_fail_prog'] },
        },
      } as any;

      await handler(event, mockContext);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Coder] Failed to transition gap gap_fail_prog to PROGRESS: Locked by another agent'
        )
      );
    });

    it('should log a warning if gap transition to OPEN fails (finally block)', async () => {
      const { logger } = await import('../lib/logger');
      const spy = vi.spyOn(logger, 'warn');

      // 1. Mock failure status
      vi.mocked(processEventWithAgent).mockResolvedValueOnce({
        responseText: 'Error',
        attachments: [],
        parsedData: { status: 'FAILED', response: 'Error' },
      });

      // 2. Mock transition: success for PROGRESS, but failure for OPEN reset
      mockMemory.updateGapStatus
        .mockResolvedValueOnce({ success: true }) // PROGRESS
        .mockResolvedValueOnce({
          success: false,
          error: 'Condition mismatch',
        }); // OPEN (reset in finally)

      const event = {
        detail: {
          userId: 'user123',
          task: 'implement feature',
          metadata: { gapIds: ['gap_fail_open'] },
        },
      } as any;

      await handler(event, mockContext);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Gaps] Failed to reset gap gap_fail_open to OPEN: Condition mismatch'
        )
      );
    });

    it('should log a warning if gap transition to DEPLOYED fails', async () => {
      const { logger } = await import('../lib/logger');
      const spy = vi.spyOn(logger, 'warn');

      // 1. Mock success but failed transition
      vi.mocked(processEventWithAgent).mockResolvedValueOnce({
        responseText: 'Completed',
        attachments: [],
        parsedData: {
          status: 'SUCCESS',
          response: 'Completed',
          patch: 'diff-1',
        },
      });

      // 2. Mock PROGRESS success, but DEPLOYED failure
      mockMemory.updateGapStatus
        .mockResolvedValueOnce({ success: true }) // PROGRESS
        .mockResolvedValueOnce({ success: false, error: 'State sync error' }); // DEPLOYED

      const event = {
        detail: {
          userId: 'user123',
          task: 'implement feature',
          metadata: { gapIds: ['gap_fail_dep'] },
        },
      } as any;

      await handler(event, mockContext);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to transition gap gap_fail_dep to DEPLOYED: State sync error'
        )
      );
    });
  });
});

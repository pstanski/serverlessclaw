import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  dispatchTask,
  listAgents,
  manageAgentTools,
  createAgent,
  deleteAgent,
  syncAgentRegistry,
  pulseCheck,
  checkAgentHealth,
} from './agent';
import { setSystemConfig } from './config';
import { emitEvent } from '../../lib/utils/bus';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock dependencies
vi.mock('../../lib/utils/bus', () => ({
  emitEvent: vi.fn().mockResolvedValue({ success: true, eventId: 'evt-123' }),
}));

const mocks = vi.hoisted(() => ({
  getAgentHealth: vi.fn(),
  getAllAgentHealth: vi.fn(),
}));

vi.mock('../../lib/memory/dynamo-memory', () => ({
  DynamoMemory: vi.fn().mockImplementation(function () {
    return {
      getAgentHealth: mocks.getAgentHealth,
      getAllAgentHealth: mocks.getAllAgentHealth,
    };
  }),
}));

vi.mock('../../lib/registry/index', () => ({
  AgentRegistry: {
    getAgentConfig: vi.fn().mockImplementation(async (id) => ({
      enabled: true,
      isBackbone: id === 'coder' || id === 'superclaw',
    })),
    getAllConfigs: vi.fn().mockResolvedValue({}),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
    deleteConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/registry/config', () => ({
  ConfigManager: {
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
    atomicRemoveFromMap: vi.fn().mockResolvedValue(undefined),
    deleteConfig: vi.fn().mockResolvedValue(undefined),
  },
  defaultDocClient: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../lib/tracer', () => ({
  ClawTracer: vi.fn().mockImplementation(function () {
    return {
      getChildTracer: vi.fn().mockReturnValue({
        getTraceId: () => 'child-trace-123',
        getNodeId: () => 'child-node-123',
        getParentId: () => 'parent-node-123',
      }),
    };
  }),
}));

vi.mock('../../lib/backbone', () => ({
  BACKBONE_REGISTRY: {
    superclaw: { id: 'superclaw', name: 'SuperClaw', isBackbone: true },
    coder: { id: 'coder', name: 'Coder', isBackbone: true },
  },
}));

vi.mock('../../lib/utils/topology', () => ({
  discoverSystemTopology: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

vi.mock('../../lib/agent/decomposer', () => ({
  decomposePlan: vi.fn().mockResolvedValue({
    originalPlan: 'test-plan',
    planId: 'plan-0',
    wasDecomposed: false,
    totalSubTasks: 0,
    subTasks: [],
  }),
}));

vi.mock('sst', () => ({
  Resource: {
    ConfigTable: { name: 'test-config-table' },
  },
}));

describe('Knowledge Agent Tools', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
  });

  describe('listAgents', () => {
    it('should list enabled agents but exclude main', async () => {
      const { AgentRegistry } = await import('../../lib/registry/index');
      vi.mocked(AgentRegistry.getAllConfigs).mockResolvedValueOnce({
        superclaw: {
          id: 'superclaw',
          name: 'SuperClaw',
          enabled: true,
          description: 'Orchestrator',
        } as any,
        coder: { id: 'coder', name: 'Coder', enabled: true, description: 'Writes code' } as any,
        disabled: { id: 'bad', name: 'Bad', enabled: false, description: 'Off' } as any,
      });

      const result = await listAgents.execute();

      expect(result).toContain('- [coder] Coder: Writes code');
      expect(result).not.toContain('SuperClaw');
      expect(result).not.toContain('[superclaw]');
      expect(result).not.toContain('Bad');
    });

    it('should return helpful message when no agents available', async () => {
      const { AgentRegistry } = await import('../../lib/registry/index');
      vi.mocked(AgentRegistry.getAllConfigs).mockResolvedValueOnce({});

      const result = await listAgents.execute();
      expect(result).toBe('No enabled agents found in the registry.');
    });
  });

  describe('dispatchTask', () => {
    it('should return TASK_PAUSED signal upon successful dispatch', async () => {
      const args = {
        agentId: 'coder',
        userId: 'user-1',
        task: 'build a feature',
        sessionId: 'session-1',
      };

      const result = await dispatchTask.execute(args);

      expect(result).toContain('TASK_PAUSED');
      expect(result).toContain('successfully dispatched this task to the **coder** agent');

      // Verify event emission
      expect(emitEvent).toHaveBeenCalledWith(
        'superclaw',
        'coder_task',
        expect.objectContaining({
          userId: 'user-1',
          task: 'build a feature',
          sessionId: 'session-1',
          traceId: 'child-trace-123',
        })
      );
    });

    it('should prevent dispatching to the main agent', async () => {
      const args = {
        agentId: 'superclaw',
        userId: 'user-1',
        task: 'build a feature',
      };

      const result = await dispatchTask.execute(args);

      expect(result).toContain("FAILED: Cannot dispatch tasks to the 'superclaw' agent");
      expect(emitEvent).not.toHaveBeenCalled();
    });

    it('should decompose complex missions into sub-tasks', async () => {
      const { decomposePlan } = await import('../../lib/agent/decomposer');
      vi.mocked(decomposePlan).mockResolvedValueOnce({
        originalPlan: 'complex mission',
        planId: 'plan-1',
        wasDecomposed: true,
        totalSubTasks: 3,
        subTasks: [
          {
            subTaskId: 'sub-1',
            planId: 'plan-1',
            task: 'Implement the backend API with auth and database connection.',
            gapIds: [],
            order: 0,
            dependencies: [],
            complexity: 5,
            agentId: 'coder',
          },
          {
            subTaskId: 'sub-2',
            planId: 'plan-1',
            task: 'Implement the frontend dashboard with responsive design.',
            gapIds: [],
            order: 1,
            dependencies: [],
            complexity: 5,
            agentId: 'coder',
          },
          {
            subTaskId: 'sub-3',
            planId: 'plan-1',
            task: 'Deploy the application and verify all resources are active.',
            gapIds: [],
            order: 2,
            dependencies: [],
            complexity: 5,
            agentId: 'coder',
          },
        ],
      });

      const args = {
        agentId: 'coder',
        userId: 'user-1',
        task: `
### Goal: CODER
Implement the backend API with auth and database connection. Ensure all routes are protected.
Actually, this next part is also for the coder.
### Goal: CODER
Implement the frontend dashboard with responsive design and theme support.
### Goal: CODER
Deploy the entire application to AWS using SST and verify all resources are active.
`,
        sessionId: 'session-complex',
      };

      const result = await dispatchTask.execute(args);

      expect(result).toContain('TASK_PAUSED');
      expect(result).toContain('decomposed this mission into 3 sub-tasks');

      // Verify multiple events emitted (total 3 sub-tasks)
      expect(emitEvent).toHaveBeenCalledTimes(3);
    });

    it('should bypass decomposition when skipDecomposition is set', async () => {
      const { decomposePlan } = await import('../../lib/agent/decomposer');

      const result = await dispatchTask.execute({
        agentId: 'coder',
        userId: 'user-1',
        task: 'A long task that would normally be decomposed before dispatching to coder.',
        skipDecomposition: true,
        sessionId: 'session-1',
      });

      expect(result).toContain('TASK_PAUSED');
      expect(decomposePlan).not.toHaveBeenCalled();
      expect(emitEvent).toHaveBeenCalledTimes(1);
      expect(emitEvent).toHaveBeenCalledWith(
        'superclaw',
        'coder_task',
        expect.objectContaining({
          userId: 'user-1',
          task: 'A long task that would normally be decomposed before dispatching to coder.',
          sessionId: 'session-1',
        })
      );
    });

    it('should surface event bus failures during single dispatch', async () => {
      vi.mocked(emitEvent).mockResolvedValueOnce({ success: false, reason: 'DLQ' });

      const result = await dispatchTask.execute({
        agentId: 'coder',
        userId: 'user-1',
        task: 'build a feature',
      });

      expect(result).toBe('Failed to dispatch task: DLQ');
    });
  });

  describe('pulseCheck', () => {
    it('should emit PULSE_PING event to verify agent connectivity', async () => {
      const result = await pulseCheck.execute({
        targetAgentId: 'coder',
        userId: 'user-pulse',
      });

      expect(result).toContain('PULSE_SENT');
      expect(result).toContain('sent a cognitive pulse to **coder**');

      expect(emitEvent).toHaveBeenCalledWith(
        'superclaw',
        'pulse_ping',
        expect.objectContaining({
          targetAgentId: 'coder',
          userId: 'user-pulse',
        })
      );
    });
  });

  describe('checkAgentHealth', () => {
    it('should return health for a specific agent', async () => {
      mocks.getAgentHealth.mockResolvedValueOnce({
        agentId: 'coder',
        status: 'online',
        latencyMs: 150,
        lastSeen: Date.now() - 5000,
      });

      const result = await checkAgentHealth.execute({ agentId: 'coder' });
      expect(result).toContain('Health Status for coder');
      expect(result).toContain('Status: online');
      expect(result).toContain('Latency: 150ms');
      expect(result).toContain('Last Seen: 5 seconds ago');
    });

    it('should return friendly message if no health data found for specific agent', async () => {
      mocks.getAgentHealth.mockResolvedValueOnce(undefined);

      const result = await checkAgentHealth.execute({ agentId: 'unknown-agent' });
      expect(result).toBe("No health data found for agent 'unknown-agent'.");
    });

    it('should return summary for all agents', async () => {
      mocks.getAllAgentHealth.mockResolvedValueOnce([
        { agentId: 'coder', status: 'online', latencyMs: 100, lastSeen: Date.now() - 2000 },
        {
          agentId: 'researcher',
          status: 'degraded',
          latencyMs: 5000,
          lastSeen: Date.now() - 10000,
        },
      ]);

      const result = await checkAgentHealth.execute({});
      expect(result).toContain('Swarm Health Status:');
      expect(result).toContain('[coder] online');
      expect(result).toContain('[researcher] degraded');
    });
  });

  describe('manageAgentTools', () => {
    it('should update agent tools via ConfigManager', async () => {
      const { ConfigManager } = await import('../../lib/registry/config');
      const result = await manageAgentTools.execute({
        agentId: 'superclaw',
        toolNames: ['tool1'],
      });

      expect(result).toContain('Successfully updated tools for agent superclaw');
      expect(ConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'superclaw_tools',
        ['tool1'],
        expect.any(Object)
      );
    });
  });

  describe('setSystemConfig', () => {
    it('should update system config via ConfigManager', async () => {
      const { ConfigManager } = await import('../../lib/registry/config');
      await setSystemConfig.execute({
        key: 'test_key',
        value: '{"foo": "bar"}',
      });

      expect(ConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'test_key',
        '{"foo": "bar"}',
        expect.any(Object)
      );
    });
  });

  describe('createAgent', () => {
    it('should create a new non-backbone agent', async () => {
      const { AgentRegistry } = await import('../../lib/registry/index');
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValueOnce(undefined);

      const result = await createAgent.execute({
        agentId: 'my-agent',
        name: 'My Agent',
        systemPrompt: 'You are a helpful assistant.',
        provider: 'openai',
        model: 'gpt-5.4-mini',
        enabled: true,
      });

      expect(result).toContain("Successfully created agent 'my-agent'");
      expect(AgentRegistry.saveConfig).toHaveBeenCalledWith(
        'my-agent',
        expect.objectContaining({
          id: 'my-agent',
          name: 'My Agent',
          systemPrompt: 'You are a helpful assistant.',
          isBackbone: false,
        }),
        expect.any(Object)
      );
    });
  });

  describe('deleteAgent', () => {
    it('should delete a non-backbone agent', async () => {
      const { AgentRegistry } = await import('../../lib/registry/index');
      vi.mocked(AgentRegistry.deleteConfig).mockResolvedValueOnce(undefined);

      const result = await deleteAgent.execute({ agentId: 'my-custom-agent' });
      expect(result).toContain("Successfully deleted agent 'my-custom-agent'");
    });
  });

  describe('syncAgentRegistry', () => {
    it('should sync registry and discover topology', async () => {
      const { AgentRegistry } = await import('../../lib/registry/index');
      vi.mocked(AgentRegistry.getAllConfigs).mockResolvedValueOnce({
        coder: { id: 'coder', name: 'Coder', enabled: true } as any,
        'strategic-planner': {
          id: 'strategic-planner',
          name: 'Strategic Planner',
          enabled: true,
        } as any,
      });

      const result = await syncAgentRegistry.execute();

      expect(result).toContain('Registry synchronized');
      expect(result).toContain('2 active agents');
    });
  });
});

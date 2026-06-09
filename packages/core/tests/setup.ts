/**
 * Global Vitest setup for @serverlessclaw/core
 */

try {
  const jestDom = '@testing-library/jest-dom';
  await import(jestDom);
} catch {
  // Optional in backend Node-only tests
}
import { vi } from 'vitest';

(global as unknown as { __CLAW_TEST__: boolean }).__CLAW_TEST__ = true;
(global as unknown as { CLAW_TEST: boolean }).CLAW_TEST = true;
(global as unknown as { IS_CLAW_TEST: boolean }).IS_CLAW_TEST = true;
process.env.CLAW_TEST = 'true';
process.env.VITEST = 'true';
process.env.CLAW_TEST = 'true';
process.env.CORE_TEST = 'true';

// Expose Resource to globalThis for consistent access in tests
// Use a proxy to return dummy values for any requested key
const globalResourceMock = new Proxy(
  {
    OpenAIApiKey: { value: 'sk-global-mock-key' },
    OpenRouterApiKey: { value: 'sk-or-global-mock-key' },
    AnthropicApiKey: { value: 'sk-ant-global-mock-key' },
    DataLakeBucket: { name: 'test-data-lake-bucket' },
    MemoryTable: { name: 'TestMemoryTable' },
    ConfigTable: { name: 'TestConfigTable' },
    TraceTable: { name: 'TestTraceTable' },
    AgentBus: { name: 'TestAgentBus' },
    StagingBucket: { name: 'TestStagingBucket' },
    KnowledgeBucket: { name: 'TestKnowledgeBucket' },
    DeployerProject: { name: 'TestDeployer' },
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      // Auto-mock any missing keys to prevent "links not active" errors
      if (prop.toLowerCase().includes('apikey')) return { value: `sk-mock-${prop}` };
      if (prop.toLowerCase().includes('table')) return { name: `Test${prop}` };
      if (prop.toLowerCase().includes('bucket')) return { name: `test-${prop.toLowerCase()}` };
      return { name: prop, value: prop, url: `https://${prop.toLowerCase()}.test` };
    },
  }
);

Object.defineProperty(globalThis, 'Resource', {
  get() {
    return globalResourceMock;
  },
  configurable: true,
});

process.env.MEMORY_TABLE_NAME = 'TestMemoryTable';
process.env.CONFIG_TABLE_NAME = 'TestConfigTable';
process.env.TRACE_TABLE_NAME = 'TestTraceTable';
process.env.AGENT_BUS_NAME = 'TestAgentBus';
process.env.STAGING_BUCKET_NAME = 'TestStagingBucket';
process.env.KNOWLEDGE_BUCKET_NAME = 'TestKnowledgeBucket';
process.env.DATA_LAKE_BUCKET_NAME = 'TestDataLakeBucket';
process.env.DEPLOYER_PROJECT_NAME = 'TestDeployer';
process.env.OPENAI_API_KEY = 'sk-dummy-test-key';

// Global mock for TokenBudgetEnforcer to ensure tests don't fail due to DDB outages
vi.mock('@claw/core/lib/metrics/token-budget-enforcer', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getTokenBudgetEnforcer: () => ({
      recordUsage: vi.fn().mockResolvedValue({
        allowed: true,
        sessionCostUsd: 0,
        sessionTokens: 0,
        percentUsed: 0,
      }),
      checkBudget: vi.fn().mockResolvedValue({
        allowed: true,
        sessionCostUsd: 0,
        sessionTokens: 0,
        percentUsed: 0,
      }),
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn(),
      getSummary: vi.fn().mockReturnValue([]),
      loadSession: vi.fn().mockResolvedValue([]),
    }),
  };
});

// Also handle relative imports
vi.mock('../lib/metrics/token-budget-enforcer', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getTokenBudgetEnforcer: () => ({
      recordUsage: vi.fn().mockResolvedValue({
        allowed: true,
        sessionCostUsd: 0,
        sessionTokens: 0,
        percentUsed: 0,
      }),
      checkBudget: vi.fn().mockResolvedValue({
        allowed: true,
        sessionCostUsd: 0,
        sessionTokens: 0,
        percentUsed: 0,
      }),
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn(),
      getSummary: vi.fn().mockReturnValue([]),
      loadSession: vi.fn().mockResolvedValue([]),
    }),
  };
});

// Global mock for CircuitBreaker to ensure tests don't fail due to DDB outages
vi.mock('../lib/safety/circuit-breaker', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    getCircuitBreaker: (...args: unknown[]) => { canProceed: (...args: unknown[]) => unknown };
    [key: string]: unknown;
  };
  return {
    ...actual,
    getCircuitBreaker: (...args: unknown[]) => {
      const instance = actual.getCircuitBreaker(...args);
      // Only mock canProceed if we are NOT in a circuit-breaker test file
      if (
        typeof expect !== 'undefined' &&
        !/circuit-breaker.*\.test/.test(expect.getState().testPath || '')
      ) {
        instance.canProceed = vi.fn().mockResolvedValue({ allowed: true, state: 'closed' });
      }
      return instance;
    },
  };
});

// Shared mocks or global settings can be added here

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

(globalThis as any).VITEST = true;
process.env.VITEST = 'true';
process.env.CLAW_TEST = 'true';
process.env.CORE_TEST = 'true';

// Provide robust baseline registry
(globalThis as any).SST_RESOURCE_REGISTRY = {
  MemoryTable: { name: 'MemoryTable' },
  ConfigTable: { name: 'ConfigTable' },
  TraceTable: { name: 'TraceTable' },
  AgentBus: { name: 'AgentBus' },
  StagingBucket: { name: 'StagingBucket' },
  KnowledgeBucket: { name: 'KnowledgeBucket' },
  DeployerProject: { name: 'DeployerProject' },
  Deployer: { name: 'Deployer' }, // Added for deployment tools
  OpenAIApiKey: { value: 'sk-global-mock-key' },
  OpenRouterApiKey: { value: 'sk-or-global-mock-key' },
  AnthropicApiKey: { value: 'sk-ant-global-mock-key' },
  MiniMaxApiKey: { value: 'sk-mini-global-mock-key' },
  DeepSeekApiKey: { value: 'sk-ds-global-mock-key' },
  ActiveProvider: { value: 'openai' },
  ActiveModel: { value: 'gpt-5.4-nano' },
};

(globalThis as any).Resource = (globalThis as any).SST_RESOURCE_REGISTRY;

vi.mock('sst', () => ({
  Resource: (globalThis as any).SST_RESOURCE_REGISTRY,
  default: { Resource: (globalThis as any).SST_RESOURCE_REGISTRY },
}));

// Provide a global mock for RateLimiter
vi.mock('../lib/utils/rate-limiter', () => ({
  RateLimiter: {
    getInstance: () => ({
      checkLimit: vi.fn().mockResolvedValue({ allowed: true, state: 'closed' }),
      canProceed: vi.fn().mockResolvedValue({ allowed: true, state: 'closed' }),
      reset: vi.fn().mockResolvedValue(true),
    }),
  },
}));

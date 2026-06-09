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

// Baseline Test Registry for resolveSSTResourceValue
(globalThis as any).SST_RESOURCE_REGISTRY = {
  OpenAIApiKey: { value: 'sk-global-mock-key' },
  OpenRouterApiKey: { value: 'sk-or-global-mock-key' },
  AnthropicApiKey: { value: 'sk-ant-global-mock-key' },
  MiniMaxApiKey: { value: 'sk-mini-global-mock-key' },
  DeepSeekApiKey: { value: 'sk-ds-global-mock-key' },
  DataLakeBucket: { name: 'test-data-lake-bucket' },
  MemoryTable: { name: 'TestMemoryTable' },
  ConfigTable: { name: 'TestConfigTable' },
  TraceTable: { name: 'TestTraceTable' },
  AgentBus: { name: 'TestAgentBus' },
  StagingBucket: { name: 'TestStagingBucket' },
  KnowledgeBucket: { name: 'TestKnowledgeBucket' },
  DeployerProject: { name: 'TestDeployer' },
  ActiveProvider: { value: 'openai' },
  ActiveModel: { value: 'gpt-5.4-nano' },
};

// Also set global Resource for tests that use it directly
(globalThis as any).Resource = (globalThis as any).SST_RESOURCE_REGISTRY;

// Mock 'sst' globally
vi.mock('sst', () => ({
  Resource: (globalThis as any).SST_RESOURCE_REGISTRY,
  default: { Resource: (globalThis as any).SST_RESOURCE_REGISTRY },
}));

// Mock AWS SDK Clients globally to prevent real calls
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: class { send = vi.fn().mockResolvedValue({}); },
  PutMetricDataCommand: class { constructor(public input: any) {} },
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class { send = vi.fn().mockResolvedValue({}); },
  SendMessageCommand: class { constructor(public input: any) {} },
}));

vi.mock('@aws-sdk/client-codebuild', () => ({
  CodeBuildClient: class { send = vi.fn().mockResolvedValue({}); },
  StartBuildCommand: class { constructor(public input: any) {} },
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

// Shared mocks or global settings can be added here

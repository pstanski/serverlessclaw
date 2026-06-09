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

// Provide a robust baseline
const baselineResource = new Proxy(
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
      if (prop.toLowerCase().includes('apikey')) return { value: `sk-mock-${prop}` };
      if (prop.toLowerCase().includes('table')) return { name: `Test${prop}` };
      if (prop.toLowerCase().includes('bucket')) return { name: `test-${prop.toLowerCase()}` };
      return { name: prop, value: prop, url: `https://${prop.toLowerCase()}.test` };
    },
  }
);

// Expose Resource to globalThis.
// It will prioritize local vi.mock('sst') if available, otherwise use baseline.
Object.defineProperty(globalThis, 'Resource', {
  get() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sst = require('sst');
      const Resource = sst.Resource || sst.default?.Resource || sst;
      // If require('sst') doesn't throw and isn't empty, it's likely a mock or real SST
      if (Resource && Object.keys(Resource).length > 0) {
        return Resource;
      }
    } catch {
      // ignore
    }
    return baselineResource;
  },
  configurable: true,
});

// Also provide a default mock for 'sst' module itself
vi.mock('sst', () => ({
  Resource: baselineResource,
  default: { Resource: baselineResource },
}));

(globalThis as any).VITEST = true;
process.env.VITEST = 'true';
process.env.CLAW_TEST = 'true';
process.env.CORE_TEST = 'true';

process.env.MEMORY_TABLE_NAME = 'TestMemoryTable';
process.env.CONFIG_TABLE_NAME = 'TestConfigTable';
process.env.TRACE_TABLE_NAME = 'TestTraceTable';
process.env.STAGING_BUCKET_NAME = 'TestStagingBucket';
process.env.KNOWLEDGE_BUCKET_NAME = 'TestKnowledgeBucket';
process.env.AGENT_BUS_NAME = 'TestAgentBus';

// Mock CloudWatch client
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  PutMetricDataCommand: class {
    constructor(public input: any) {}
  },
}));

// Mock SQS client
vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send = vi.fn().mockResolvedValue({});
  },
  SendMessageCommand: class {
    constructor(public input: any) {}
  },
}));

// Provide a global mock for RateLimiter
vi.mock('../lib/utils/rate-limiter', () => {
  return {
    RateLimiter: {
      getInstance: () => {
        const instance = {
          checkLimit: vi.fn().mockResolvedValue({ allowed: true, state: 'closed' }),
          canProceed: vi.fn().mockResolvedValue({ allowed: true, state: 'closed' }),
          reset: vi.fn().mockResolvedValue(true),
        };
        if (
          expect.getState().testPath &&
          /rate-limiter\.test\.ts/.test(expect.getState().testPath || '')
        ) {
          instance.canProceed = vi.fn().mockResolvedValue({ allowed: true, state: 'closed' });
        }
        return instance;
      },
    },
  };
});

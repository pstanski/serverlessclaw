import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { CodeBuildClient } from '@aws-sdk/client-codebuild';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const codebuildMock = mockClient(CodeBuildClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

import { triggerDeployment } from './deployment';
import { incrementDeployCount } from '../../lib/metrics/deploy-stats';
import { getCircuitBreaker } from '../../lib/safety/circuit-breaker';

vi.mock('../../lib/metrics/deploy-stats', () => ({
  getDeployCountToday: vi.fn(),
  incrementDeployCount: vi.fn(),
  rewardDeployLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/safety/circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    canProceed: vi.fn(),
    recordFailure: vi.fn(),
  })),
}));

describe('Deployment Tools', () => {
  beforeEach(() => {
    codebuildMock.reset();
    ddbMock.reset();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('triggerDeployment', () => {
    it('blocks deployment when daily limit is reached', async () => {
      vi.mocked(getCircuitBreaker).mockReturnValue({
        canProceed: vi.fn().mockResolvedValue({ allowed: true }),
        recordFailure: vi.fn(),
      } as any);
      vi.mocked(incrementDeployCount).mockResolvedValue(false);
      ddbMock.on(GetCommand).resolves({ Item: { value: '10' } });

      const result = await triggerDeployment.execute({
        reason: 'test deployment',
        userId: 'test-user',
      });

      expect(result).toContain('Daily deployment limit reached');
    });

    it('blocks deployment when a target gap is still in exponential backoff', async () => {
      vi.mocked(getCircuitBreaker).mockReturnValue({
        canProceed: vi.fn().mockResolvedValue({ allowed: true }),
        recordFailure: vi.fn(),
      } as any);
      vi.mocked(incrementDeployCount).mockResolvedValue(true);
      ddbMock.on(GetCommand).resolves({
        Item: {
          value: {
            'GAP#1': { status: 'FAILED', backoffUntil: Date.now() + 100000 },
          },
        },
      });

      const result = await triggerDeployment.execute({
        reason: 'test deployment',
        userId: 'test-user',
        gapId: 'GAP#1',
      });

      expect(result).toContain('BACKOFF_ACTIVE');
    });
  });
});

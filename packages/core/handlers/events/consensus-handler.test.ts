import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('sst', () => ({
  Resource: { MemoryTable: { name: 'test-table' } },
}));

vi.mock('../../lib/utils/ddb-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/utils/ddb-client')>()),
  getDocClient: () => ddbMock,
  getMemoryTableName: vi.fn().mockResolvedValue('test-table'),
}));

vi.mock('../../lib/utils/bus', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/memory/reputation-operations', () => ({
  computeReputationScore: vi.fn((rep: { successRate: number }) => rep.successRate),
  getReputation: vi.fn().mockResolvedValue(null),
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handleConsensus } from './consensus-handler';
import { EventType } from '../../lib/types/agent';
import { emitEvent } from '../../lib/utils/bus';

describe('Consensus Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
  });

  describe('CONSENSUS_REQUEST', () => {
    it('should initialize consensus state in DynamoDB', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await handleConsensus(
        {
          detail: {
            requestId: 'req-1',
            proposal: 'Deploy feature X',
            initiatorId: 'planner',
            participants: ['coder', 'qa', 'security'],
            mode: 'majority',
          },
        },
        EventType.CONSENSUS_REQUEST
      );

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls).toHaveLength(1);
      const item = calls[0].args[0].input;
      expect(item.Key).toEqual({ userId: 'CONSENSUS#req-1', timestamp: 0 });
      expect(item.ExpressionAttributeValues?.[':status']).toBe('PENDING');
      expect(item.ExpressionAttributeValues?.[':mode']).toBe('majority');
    });

    it('should default to majority mode', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await handleConsensus(
        {
          detail: {
            requestId: 'req-2',
            proposal: 'Test proposal',
            initiatorId: 'planner',
            participants: ['a', 'b', 'c'],
          },
        },
        EventType.CONSENSUS_REQUEST
      );

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls[0].args[0].input.ExpressionAttributeValues?.[':mode']).toBe('majority');
    });
  });

  describe('CONSENSUS_VOTE — majority mode', () => {
    it('should approve when majority yes votes received', async () => {
      // Simulate 3 participants, 2 yes votes
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          initiatorId: 'planner',
          votes: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          initiatorId: 'planner',
          votes: [
            { userId: 'a', vote: 'yes' },
            { userId: 'b', vote: 'yes' },
          ],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-3',
            userId: 'a',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            requestId: 'req-3',
            status: 'APPROVED',
          }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('should reject when majority no votes received', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'no' }],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          votes: [
            { userId: 'a', vote: 'no' },
            { userId: 'b', vote: 'no' },
          ],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-4',
            userId: 'b',
            vote: 'no',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            requestId: 'req-4',
            status: 'REJECTED',
          }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('should not finalize when not enough votes yet', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          votes: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'yes' }],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-5',
            userId: 'a',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).not.toHaveBeenCalledWith(
        expect.anything(),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('P0 Fix: should reject votes from non-participants', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b', 'c'],
          mode: 'majority',
          status: 'PENDING',
          votes: [],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-6',
            userId: 'intruder',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    });
  });

  describe('CONSENSUS_VOTE — unanimous mode', () => {
    it('should approve only when all vote yes', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'yes' }],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [
            { userId: 'a', vote: 'yes' },
            { userId: 'b', vote: 'yes' },
          ],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-7',
            userId: 'b',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ status: 'APPROVED' }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('should reject if any single vote is no', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'no' }],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-8',
            userId: 'a',
            vote: 'no',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ status: 'REJECTED' }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('should wait for all votes before deciding', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b'],
          mode: 'unanimous',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'yes' }],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-9',
            userId: 'a',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).not.toHaveBeenCalledWith(
        expect.anything(),
        EventType.CONSENSUS_DECIDED
      );
    });
  });

  describe('CONSENSUS_VOTE — weighted mode', () => {
    it('should approve when weighted yes exceeds 50%', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b'],
          weights: { a: 0.6, b: 0.4 },
          mode: 'weighted',
          status: 'PENDING',
          votes: [],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b'],
          weights: { a: 0.6, b: 0.4 },
          mode: 'weighted',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'yes' }],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-10',
            userId: 'a',
            vote: 'yes',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ status: 'APPROVED' }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });

    it('should reject when weighted yes is below 50%', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          participants: ['a', 'b', 'c'],
          weights: { a: 0.3, b: 0.3, c: 0.4 },
          mode: 'weighted',
          status: 'PENDING',
          votes: [{ userId: 'a', vote: 'no' }],
        },
      });
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          participants: ['a', 'b', 'c'],
          weights: { a: 0.3, b: 0.3, c: 0.4 },
          mode: 'weighted',
          status: 'PENDING',
          votes: [
            { userId: 'a', vote: 'no' },
            { userId: 'b', vote: 'no' },
          ],
        },
      });

      await handleConsensus(
        {
          detail: {
            requestId: 'req-11',
            userId: 'b',
            vote: 'no',
          },
        },
        EventType.CONSENSUS_VOTE
      );

      expect(emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ status: 'REJECTED' }),
        }),
        EventType.CONSENSUS_DECIDED
      );
    });
  });
});

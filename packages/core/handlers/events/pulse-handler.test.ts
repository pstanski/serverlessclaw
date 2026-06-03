import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePulsePing, handlePulsePong } from './pulse-handler';
import { emitEvent } from '../../lib/utils/bus';
import { AGENT_TYPES, EventType } from '../../lib/types/agent';
import { logger } from '../../lib/logger';

vi.mock('../../lib/utils/bus', () => ({
  emitEvent: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Pulse Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_ID = AGENT_TYPES.CODER;
  });

  describe('handlePulsePing', () => {
    it('should emit PULSE_PONG event when target is for this agent', async () => {
      const payload = {
        userId: 'user-123',
        traceId: 'trace-123',
        targetAgentId: AGENT_TYPES.CODER,
        initiatorId: AGENT_TYPES.SUPERCLAW,
        timestamp: Date.now(),
      };

      await handlePulsePing(payload, {} as any);

      expect(emitEvent).toHaveBeenCalledWith(
        AGENT_TYPES.CODER,
        EventType.PULSE_PONG,
        expect.objectContaining({
          userId: 'user-123',
          traceId: 'trace-123',
          status: 'pong',
          targetAgentId: AGENT_TYPES.CODER,
        })
      );
    });

    it('should NOT emit PULSE_PONG if the target is another agent', async () => {
      const payload = {
        userId: 'user-123',
        traceId: 'trace-123',
        targetAgentId: AGENT_TYPES.RESEARCHER,
        initiatorId: AGENT_TYPES.SUPERCLAW,
        timestamp: Date.now(),
      };

      await handlePulsePing(payload, {} as any);

      expect(emitEvent).not.toHaveBeenCalled();
    });
  });

  describe('handlePulsePong', () => {
    it('should log the pong and latency', async () => {
      const now = Date.now();
      const payload = {
        userId: 'user-123',
        traceId: 'trace-123',
        targetAgentId: AGENT_TYPES.CODER,
        initiatorId: AGENT_TYPES.SUPERCLAW,
        timestamp: now - 100,
        responseTimestamp: now,
        status: 'pong',
      };

      await handlePulsePong(payload, {} as any);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received pong from coder'),
        expect.objectContaining({
          latencyMs: expect.any(Number),
        })
      );
    });
  });
});

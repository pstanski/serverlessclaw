import { BaseMemoryProvider } from './base';
import { MEMORY_KEYS, RETENTION } from '../constants/memory';
import { AgentHealth } from '../types/agent/health';
import { logger } from '../logger';
import { TIME } from '../constants/network';

/**
 * Health Operations Module.
 * Manages per-agent health status and heartbeats in DynamoDB.
 */

/**
 * Updates the health record for an agent.
 */
export async function updateAgentHealth(
  provider: BaseMemoryProvider,
  agentId: string,
  health: Partial<Omit<AgentHealth, 'agentId'>>,
  options: { workspaceId?: string } = {}
): Promise<void> {
  const basePk = `${MEMORY_KEYS.HEALTH_PREFIX}${agentId}`;
  const pk = provider.getScopedUserId(basePk, options.workspaceId);
  const now = Date.now();

  // 7-day retention for health records
  const expiresAt = Math.floor(now / TIME.MS_PER_SECOND) + RETENTION.HEALTH_DAYS * 24 * 3600;

  try {
    await provider.putItem({
      userId: pk,
      timestamp: 0, // Current status record
      type: 'AGENT_HEALTH',
      agentId,
      lastSeen: now,
      status: health.status || 'online',
      latencyMs: health.latencyMs ?? -1,
      version: health.version,
      message: health.message,
      workspaceId: options.workspaceId,
      expiresAt,
    });
  } catch (error) {
    logger.error(`[HealthOps] Failed to update health for ${agentId}:`, error);
    throw error;
  }
}

/**
 * Retrieves health status for a single agent.
 */
export async function getAgentHealth(
  provider: BaseMemoryProvider,
  agentId: string,
  options: { workspaceId?: string } = {}
): Promise<AgentHealth | undefined> {
  const basePk = `${MEMORY_KEYS.HEALTH_PREFIX}${agentId}`;
  const pk = provider.getScopedUserId(basePk, options.workspaceId);

  try {
    const items = await provider.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts = :ts',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': pk, ':ts': 0 },
    });

    if (items.length === 0) return undefined;
    return items[0] as unknown as AgentHealth;
  } catch (error) {
    logger.error(`[HealthOps] Failed to get health for ${agentId}:`, error);
    return undefined;
  }
}

/**
 * Lists health status for all agents in a workspace or globally.
 * Note: Uses scanByPrefix, use sparingly.
 */
export async function getAllAgentHealth(
  provider: BaseMemoryProvider,
  options: { workspaceId?: string } = {}
): Promise<AgentHealth[]> {
  const prefix = options.workspaceId
    ? `WS#${options.workspaceId}#${MEMORY_KEYS.HEALTH_PREFIX}`
    : MEMORY_KEYS.HEALTH_PREFIX;

  try {
    const items = await provider.listByPrefix(prefix);
    return items
      .filter((item) => item.timestamp === 0)
      .map((item) => item as unknown as AgentHealth);
  } catch (error) {
    logger.error('[HealthOps] Failed to list agent health:', error);
    return [];
  }
}

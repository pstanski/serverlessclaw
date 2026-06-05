import { DynamoMemoryCollaboration } from './collaboration';
import { AgentHealth } from '../../types/agent/health';
import { updateAgentHealth, getAgentHealth, getAllAgentHealth } from '../health-operations';

/**
 * Health module for DynamoMemory.
 */
export class DynamoMemoryHealth extends DynamoMemoryCollaboration {
  /**
   * Updates the health record for an agent.
   */
  async updateAgentHealth(
    agentId: string,
    health: Partial<Omit<AgentHealth, 'agentId'>>,
    options?: { workspaceId?: string }
  ) {
    return updateAgentHealth(this, agentId, health, options);
  }

  /**
   * Retrieves health status for a single agent.
   */
  async getAgentHealth(agentId: string, options?: { workspaceId?: string }) {
    return getAgentHealth(this, agentId, options);
  }

  /**
   * Lists health status for all agents.
   */
  async getAllAgentHealth(options?: { workspaceId?: string }) {
    return getAllAgentHealth(this, options);
  }
}

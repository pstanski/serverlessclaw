/**
 * Real-time health status of an autonomous agent.
 */
export interface AgentHealth {
  /** The unique identifier of the agent. */
  agentId: string;
  /** Current operational status. */
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  /** ISO timestamp of the last heartbeat/pong. */
  lastSeen: number;
  /** Last measured latency in milliseconds. */
  latencyMs: number;
  /** Optional workspace identifier for multi-tenant isolation. */
  workspaceId?: string;
  /** Optional agent version for deployment tracking. */
  version?: string;
  /** Optional error message or health details. */
  message?: string;
}

/**
 * Filter options for agent health queries.
 */
export interface AgentHealthFilter {
  workspaceId?: string;
  status?: AgentHealth['status'];
}

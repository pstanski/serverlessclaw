import { IToolDefinition, ToolType } from '../../lib/types/index';
import { z } from 'zod';
import { agentSchema } from './definitions/agent';
import { memorySchema } from './definitions/memory';
import { gapSchema } from './definitions/gaps';
import { skillSchema } from './definitions/skills';
import { researchSchema } from './definitions/research';
import { mcpSchema } from './definitions/mcp';
import { metadataSchema } from './definitions/metadata';
import { configSchema } from './schema-config';

/**
 * Knowledge Domain Tool Definitions
 * Aggregates specialized tool definitions from sub-modules.
 */
export const knowledgeSchema: Record<string, IToolDefinition> = {
  ...agentSchema,
  ...memorySchema,
  ...gapSchema,
  ...skillSchema,
  ...researchSchema,
  ...mcpSchema,
  ...metadataSchema,
  ...configSchema,
  checkAgentHealth: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'checkAgentHealth',
    description: 'Retrieves the real-time health and latency status of agents in the swarm.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Optional: Specific agent ID to check.' },
      },
      additionalProperties: false,
    },
    connectionProfile: ['memoryTable'],
    requiresApproval: false,
    requiredPermissions: [],
  },
};

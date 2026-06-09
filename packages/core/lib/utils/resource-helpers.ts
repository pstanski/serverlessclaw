/**
 * Robustly resolves an SST resource property (e.g., 'name', 'value', 'endpoint')
 * from the Resource object or environment fallbacks.
 * Handles SST Ion (v3/v4) JSON-encoded environment variables.
 *
 * @param resourceName - The name of the SST resource (e.g., 'MyTable').
 * @param property - The property to retrieve (e.g., 'name', 'value', 'url').
 * @param fallbackEnvVar - Optional environment variable name to check as a fallback.
 * @param defaultValue - Optional default value if the resource cannot be resolved.
 * @returns The resolved value or the default value.
 */
export function resolveSSTResourceValue(
  resourceName: string,
  property: string,
  fallbackEnvVar?: string,
  defaultValue?: string
): string | undefined {
  // 1. Try direct environment override first (most reliable for tests and k8s)
  if (fallbackEnvVar && process.env[fallbackEnvVar]) {
    return process.env[fallbackEnvVar]!;
  }

  // 2. Try Test Registry (for consistent mocking in Vitest/monorepo)
  try {
    const registry = (globalThis as any).SST_RESOURCE_REGISTRY;
    if (registry && registry[resourceName] && registry[resourceName][property]) {
      return registry[resourceName][property];
    }
    // If explicitly set to null/undefined in registry, treat as unlinked
    if (registry && Object.prototype.hasOwnProperty.call(registry, resourceName) && registry[resourceName] === null) {
        return undefined;
    }
  } catch {
    // ignore
  }

  // 3. Try SST Ion JSON environment variables (v3/v4 standalone mode)
  const app = process.env.SST_RESOURCE_App;
  if (app) {
    try {
      const parsed = JSON.parse(app);
      if (parsed[resourceName] && parsed[resourceName][property]) {
        return parsed[resourceName][property];
      }
    } catch {
      // ignore
    }
  }

  // 4. Try traditional Resource access
  // We use a require inside the function to avoid module load time crashes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sst = require('sst');
    const Resource = sst.Resource || sst.default?.Resource || sst;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Resource && (Resource as any)[resourceName] && (Resource as any)[resourceName][property]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (Resource as any)[resourceName][property];
    }
  } catch {
    // ignore (e.g. "SST links are not active" error)
  }

  return defaultValue ?? undefined;
}

/**
 * Common resource accessors for convenience and type safety.
 */
export const getWebhookApiUrl = () =>
  resolveSSTResourceValue('WebhookApi', 'url', 'WEBHOOK_API_URL');
export const getAwsRegion = () =>
  resolveSSTResourceValue('AwsRegion', 'value', 'AWS_REGION', 'ap-southeast-2');
export const getMemoryTableName = () =>
  resolveSSTResourceValue('MemoryTable', 'name', 'MEMORY_TABLE_NAME');
export const getConfigTableName = () =>
  resolveSSTResourceValue('ConfigTable', 'name', 'CONFIG_TABLE_NAME');
export const getTraceTableName = () =>
  resolveSSTResourceValue('TraceTable', 'name', 'TRACE_TABLE_NAME');
export const getStagingBucketName = () =>
  resolveSSTResourceValue('StagingBucket', 'name', 'STAGING_BUCKET_NAME');
export const getKnowledgeBucketName = () =>
  resolveSSTResourceValue('KnowledgeBucket', 'name', 'KNOWLEDGE_BUCKET_NAME');
export const getAgentBusName = () => resolveSSTResourceValue('AgentBus', 'name', 'AGENT_BUS_NAME');
export const getDeployerProjectName = () =>
  resolveSSTResourceValue('Deployer', 'name', 'DEPLOYER_PROJECT_NAME') ||
  resolveSSTResourceValue('DeployerProject', 'name', 'DEPLOYER_PROJECT_NAME') ||
  resolveSSTResourceValue('SelfDeployProject', 'name', 'DEPLOYER_PROJECT_NAME');
export const getPlannerQueueUrl = () =>
  resolveSSTResourceValue('PlannerQueue', 'url', 'PLANNER_QUEUE_URL');
export const getAppInfo = () => ({
  name: resolveSSTResourceValue('App', 'name', 'APP_NAME', 'serverlessclaw'),
  stage: resolveSSTResourceValue('App', 'stage', 'APP_STAGE', 'local'),
});

/**
 * Resolves the WebSocket URL for the AWS IoT endpoint.
 */
export function getRealtimeInfo(): { url: string | null; endpoint: string | null; authorizer: string | null } {
  const endpoint = resolveSSTResourceValue('IotEndpoint', 'endpoint', 'IOT_ENDPOINT') || null;
  const authorizer = resolveSSTResourceValue('IotEndpoint', 'authorizer', 'IOT_AUTHORIZER') || null;

  const url = endpoint
    ? endpoint.startsWith('wss://')
      ? endpoint
      : endpoint.startsWith('https://')
        ? endpoint.replace('https://', 'wss://')
        : `wss://${endpoint}`
    : null;

  return { url, endpoint, authorizer };
}

/**
 * Legacy wrapper for getRealtimeInfo
 */
export const getIotEndpoint = getRealtimeInfo;

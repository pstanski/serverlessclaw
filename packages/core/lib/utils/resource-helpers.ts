/**
 * Robustly resolves an SST resource property (e.g., 'name', 'value', 'endpoint')
 * from the Resource object or environment fallbacks.
 * Handles SST Ion (v3/v4) JSON-encoded environment variables.
 *
 * @param resourceName - The name of the resource (e.g., 'MemoryTable').
 * @param property - The property to extract (e.g., 'name', 'value').
 * @param fallbackEnvVar - Optional explicit override env var.
 * @param defaultValue - Fallback if nothing else is found.
 * @returns The resolved resource property string.
 */
export function resolveSSTResourceValue(
  resourceName: string,
  property: string = 'name',
  fallbackEnvVar?: string,
  defaultValue?: string
): string | undefined {
  // 1. Try explicit override env var (highest priority)
  if (fallbackEnvVar && process.env[fallbackEnvVar]) {
    return process.env[fallbackEnvVar]!;
  }

  // 2. Try SST Ion JSON fallback (SST_RESOURCE_<Name>)
  const ionEnvVar = `SST_RESOURCE_${resourceName}`;
  const ionValue = process.env[ionEnvVar];
  if (ionValue) {
    try {
      const parsed = JSON.parse(ionValue);
      if (parsed && typeof parsed === 'object' && parsed[property]) {
        return parsed[property];
      }
    } catch {
      if (property === 'name' || property === 'value') return ionValue;
    }
  }

  // 2. Try globalResource (for tests and specialized environments)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalResource = (globalThis as any).Resource;
    if (globalResource && globalResource[resourceName] && globalResource[resourceName][property]) {
      if (process.env.VITEST) console.error(`[DEBUG] resolveSSTResourceValue found in globalResource: ${resourceName}.${property}=${globalResource[resourceName][property]}`);
      return globalResource[resourceName][property];
    }
  } catch {
    // ignore (e.g. SST Resource proxy throwing "links not active")
  }

  // 3. Try traditional Resource access
  // We use a require inside the function to avoid module load time crashes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sst = require('sst');
    const Resource = sst.Resource || sst.default?.Resource || sst;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Resource && (Resource as any)[resourceName] && (Resource as any)[resourceName][property]) {
      if (process.env.VITEST) console.error(`[DEBUG] resolveSSTResourceValue found in require('sst'): ${resourceName}.${property}=${(Resource as any)[resourceName][property]}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (Resource as any)[resourceName][property];
    }
  } catch (e) {
    if (process.env.VITEST) console.error(`[DEBUG] resolveSSTResourceValue require('sst') failed:`, e);
    // ignore
  }

  // 4. Try explicit override env var (e.g. OPENAI_API_KEY)
  if (fallbackEnvVar && process.env[fallbackEnvVar]) {
    return process.env[fallbackEnvVar]!;
  }

  // 5. Fuzzy Env Match (Robust Fallback)
  const fuzzyPrefix = resourceName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const fuzzyProp = property.toUpperCase();
  const fuzzyMatch = Object.keys(process.env).find(
    (k) => k.includes(fuzzyPrefix) && k.includes(fuzzyProp)
  );
  if (fuzzyMatch) return process.env[fuzzyMatch];

  return defaultValue;
}

/** Getters for common resources */
export const getAgentBusName = () =>
  resolveSSTResourceValue('AgentBus', 'name', 'AGENT_BUS_NAME', 'AgentBus');
export const getStagingBucketName = () =>
  resolveSSTResourceValue('StagingBucket', 'name', 'STAGING_BUCKET_NAME', 'StagingBucket');
export const getKnowledgeBucketName = () =>
  resolveSSTResourceValue('KnowledgeBucket', 'name', 'KNOWLEDGE_BUCKET_NAME', 'KnowledgeBucket');
export const getWebhookApiUrl = () =>
  resolveSSTResourceValue('WebhookApi', 'url', 'WEBHOOK_API_URL');
export const getAwsRegion = () =>
  resolveSSTResourceValue('AwsRegion', 'value', 'AWS_REGION', 'ap-southeast-2');
export const getMemoryTableName = () =>
  resolveSSTResourceValue('MemoryTable', 'name', 'MEMORY_TABLE_NAME');
export const getTraceTableName = () =>
  resolveSSTResourceValue('TraceTable', 'name', 'TRACE_TABLE_NAME');
export const getConfigTableName = () =>
  resolveSSTResourceValue('ConfigTable', 'name', 'CONFIG_TABLE_NAME');
export const getPlannerQueueUrl = () =>
  resolveSSTResourceValue('PlannerQueue', 'url', 'PLANNER_QUEUE_URL');

/** Gets application metadata (name and stage) */
export function getAppInfo(): { name: string; stage: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require('sst');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Resource && (Resource as any).App) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { name: (Resource as any).App.name, stage: (Resource as any).App.stage };
    }
  } catch {
    // ignore
  }

  const ionApp = process.env.SST_RESOURCE_App;
  if (ionApp) {
    try {
      const parsed = JSON.parse(ionApp);
      if (parsed.name && parsed.stage) {
        return { name: parsed.name, stage: parsed.stage };
      }
    } catch {
      // ignore
    }
  }

  return {
    name: process.env.SST_APP || 'serverlessclaw',
    stage: process.env.SST_STAGE || 'local',
  };
}

/** Gets RealtimeBus (IoT) metadata */
export function getRealtimeInfo(): { url: string | null; authorizer: string | null } {
  const endpoint = resolveSSTResourceValue('RealtimeBus', 'endpoint', 'IOT_ENDPOINT');
  const authorizer = resolveSSTResourceValue('RealtimeBus', 'authorizer', 'IOT_AUTHORIZER');

  const url = endpoint
    ? endpoint.startsWith('wss://')
      ? endpoint
      : endpoint.startsWith('https://')
        ? endpoint.replace('https://', 'wss://')
        : `wss://${endpoint}`
    : null;

  return { url, authorizer: authorizer ?? null };
}

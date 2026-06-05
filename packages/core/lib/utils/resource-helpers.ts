import { Resource } from 'sst';
import { logger } from '../logger';

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

  // 3. Try traditional Resource access ONLY as a last resort and ONLY if no fallback was found
  // We wrap this in an extremely aggressive try/catch because the SST proxy can throw ENOENT
  try {
    const resource = Resource as any;
    if (resource && resource[resourceName] && resource[resourceName][property]) {
      return resource[resourceName][property];
    }
  } catch (e) {
    // SST proxy failed (e.g. missing resource.enc), ignore and move to fuzzy match
  }

  // 4. Fuzzy Env Match (Robust Fallback)
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

export function getAppInfo(): { name: string; stage: string } {
  try {
    const resource = Resource as any;
    if (resource.App) {
      return { name: resource.App.name, stage: resource.App.stage };
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

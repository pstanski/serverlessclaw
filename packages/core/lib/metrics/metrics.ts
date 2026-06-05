/**
 * CloudWatch Metrics Module
 */

import { persistToDynamoDB } from './persistence';
import { MetricDatum } from './types';

const NAMESPACE = process.env.SST_APP || 'Framework';
type MetricsCardinalityMode = 'full' | 'low';

const LOW_CARDINALITY_ALLOWED_DIMENSIONS = new Set([
  'AgentId',
  'Success',
  'ToolName',
  'Type',
  'EventType',
  'Provider',
  'OverallStatus',
  'FromStatus',
  'ToStatus',
  'Operation',
  'TableName',
  'RepairType',
  'OrgId',
  'WorkspaceId',
]);

const MAX_DIMENSION_VALUE_LENGTH = 80;

interface CloudWatchClientType {
  send: (command: unknown) => Promise<unknown>;
}

let cloudwatch: CloudWatchClientType | null = null;

function getMetricsCardinalityMode(): MetricsCardinalityMode {
  const explicitMode = process.env.METRICS_CARDINALITY_MODE?.toLowerCase();
  if (explicitMode === 'full' || explicitMode === 'low') {
    return explicitMode;
  }

  const stage = (process.env.SST_STAGE || process.env.STAGE || '').toLowerCase();
  return stage === 'prod' ? 'low' : 'full';
}

function sanitizeDimensions(
  dimensions: MetricDatum['Dimensions'],
  mode: MetricsCardinalityMode
): MetricDatum['Dimensions'] {
  if (!dimensions || dimensions.length === 0) return undefined;

  const byName = new Map<string, string>();
  for (const dimension of dimensions) {
    if (!dimension?.Name || typeof dimension.Value !== 'string') continue;
    if (mode === 'low' && !LOW_CARDINALITY_ALLOWED_DIMENSIONS.has(dimension.Name)) continue;

    if (!byName.has(dimension.Name)) {
      byName.set(dimension.Name, dimension.Value.slice(0, MAX_DIMENSION_VALUE_LENGTH));
    }
  }

  if (byName.size === 0) return undefined;
  return Array.from(byName.entries()).map(([Name, Value]) => ({ Name, Value }));
}

async function getCloudWatchClient(): Promise<CloudWatchClientType | null> {
  if (cloudwatch) return cloudwatch;
  try {
    const { CloudWatchClient } = await import('@aws-sdk/client-cloudwatch');
    cloudwatch = new CloudWatchClient({}) as CloudWatchClientType;
    return cloudwatch;
  } catch {
    return null;
  }
}

export { type MetricDatum };

/**
 * Emits metrics to CloudWatch or falls back to DynamoDB.
 */
export async function emitMetrics(metrics: MetricDatum[]): Promise<void> {
  if (metrics.length === 0) return;
  const cardinalityMode = getMetricsCardinalityMode();

  const cw = await getCloudWatchClient();
  if (!cw) {
    const { logger } = await import('../logger');
    logger.warn('[METRICS] CloudWatch not available, persisting critical metrics to DynamoDB');
    await persistToDynamoDB(metrics);
    return;
  }

  try {
    const { PutMetricDataCommand } = await import('@aws-sdk/client-cloudwatch');
    const normalizedMetricData = metrics.map((m) => ({
      MetricName: m.MetricName,
      Value: m.Value,
      Unit: m.Unit || 'Count',
      Dimensions: sanitizeDimensions(m.Dimensions, cardinalityMode),
      Timestamp: new Date(),
    }));

    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: normalizedMetricData,
    });
    await cw.send(command);
  } catch (error) {
    const { logger } = await import('../logger');
    logger.error('[METRICS] Failed to emit CloudWatch metrics, falling back to DynamoDB', {
      error,
    });
    await persistToDynamoDB(metrics);
  }
}

export * from './registry';

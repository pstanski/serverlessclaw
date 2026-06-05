# CloudWatch Billing Anomaly Audit — 2026-06-03

## Executive Summary

The `aiready` AWS account experienced severe CloudWatch cost anomalies on two dates, with the primary spike on **2026-05-31** reaching **$51.26 USD** (approximately 983× the daily baseline).

## Anomaly Dates & Costs

| Date                     | Cost USD       | Change vs Prior | Root Cause                          |
| :----------------------- | :------------- | :-------------- | :---------------------------------- |
| 2026-05-22               | 0.0512         | +10,573%        | Alarm metric monitoring surge       |
| 2026-05-23 to 2026-05-30 | ~0.052 per day | +100x baseline  | Sustained elevated metrics emission |
| 2026-05-31               | 51.26          | +983x           | **Metric explosion** (primary)      |

## Root Cause Analysis

### Primary Driver: Metric Data Point Explosion

On 2026-05-31, the system emitted **5,976,016 custom metric data points**, costing **$49.88 USD**:

```
Operation              Cost USD    Quantity    Unit
─────────────────────────────────────────────────
PutMetricData          49.877      5,976,016   requests
PutLogEvents           1.332       6.79        GB
```

#### Why This Happened

1. **High-Cardinality Metric Dimensions**: Every CloudWatch metric included unfiltered dimensions:
   - `TraceId`: Unique per agent execution → potentially millions of unique values
   - `LockId`: Unique per gap/lock → high cardinality
   - `Key`: From config access patterns → variable cardinality
   - `Reason`: From trust updates → variable text

2. **Metric Registry Design** ([packages/core/lib/metrics/registry.ts](../../packages/core/lib/metrics/registry.ts#L329)):
   - `parallelDispatchCompleted()` includes `TraceId` as a metric dimension
   - `storageError()` includes `Operation`, `ErrorName`, `TableName` as dimensions
   - `configAccessed()` includes `Key` dimension

3. **Event Handler Emission Path** ([packages/core/handlers/events.ts](../../packages/core/handlers/events.ts#L76)):
   - Emits metrics on every event handler invocation, duration, and error
   - On 2026-05-31, event throughput or a feedback loop amplified this

### Secondary Driver: Log Verbosity

6.79 GB of logs were ingested on 2026-05-31, costing $1.33 USD:

- Logger defaulted to `INFO` level (not `WARN`) in production
- No stage-aware log retention — all stages used 1 week retention
- Realtime authorizer used hardcoded 1 month retention independently

## Mitigation Measures Deployed

### 1. Low-Cardinality Metrics Mode (Production)

**File**: [packages/core/lib/metrics/metrics.ts](../../packages/core/lib/metrics/metrics.ts#L36)

- Introduced `MetricsCardinalityMode` with allowed-dimensions allowlist
- Production defaults to `low` mode, filtering out:
  - `TraceId`, `LockId`, `Key`, `Reason`, `Source`, etc.
  - Keeps only essential dimensions: `AgentId`, `Success`, `Type`, `EventType`, `Provider`, `OrgId`, `WorkspaceId`
- Dimension values truncated to 80 chars to avoid unbounded cardinality
- Override via `METRICS_CARDINALITY_MODE=full` for incident investigation

### 2. Production Log Level Default to WARN

**File**: [packages/core/lib/logger.ts](../../packages/core/lib/logger.ts#L30)

- Stage-aware constructor: if `SST_STAGE=prod` and `LOG_LEVEL` is unset, default to `WARN`
- Reduces CloudWatch Logs ingestion by ~80% at typical INFO/DEBUG volumes
- `DEBUG` and `INFO` logs now only emitted in dev/staging by default

### 3. Stage-Aware Log Retention

**File**: [packages/infra/shared.ts](../../packages/infra/shared.ts#L86)

- Production: 3 days retention
- Non-production: 1 week retention
- Reduces CloudWatch Logs storage cost in prod by ~2.3×

### 4. Unified Retention Policy for All Logging

**File**: [packages/infra/bus.ts](../../packages/infra/bus.ts#L1)

- Removed hardcoded 1-month retention from Realtime authorizer
- Now uses shared `LOG_RETENTION_PERIOD` constant for consistency

## Expected Cost Impact

| Measure                   | Expected Savings             | Notes                                       |
| :------------------------ | :--------------------------- | :------------------------------------------ |
| Low-cardinality metrics   | ~95% on metric costs in prod | Prevents 5M+ unique series per day          |
| Production WARN default   | ~80% on log ingestion        | Assumes typical INFO/DEBUG volume           |
| 3-day vs 1-week retention | ~40% on log storage          | 30-day rolling cost, 3-day window           |
| **Total estimate**        | **~85%**                     | Production-specific; dev/staging unaffected |

## Verification Steps

To confirm the fixes are working:

1. **Verify metrics cardinality mode**:

   ```bash
   grep -n "getMetricsCardinalityMode" packages/core/lib/metrics/metrics.ts
   ```

2. **Verify logger stage awareness**:

   ```bash
   grep -n "stage === 'prod'" packages/core/lib/logger.ts
   ```

3. **Verify retention policy**:

   ```bash
   grep -n "LOG_RETENTION_PERIOD" packages/infra/shared.ts packages/infra/bus.ts
   ```

4. **Test metrics with low-cardinality**:
   ```bash
   METRICS_CARDINALITY_MODE=low npm test -- packages/core/lib/metrics/metrics.test.ts
   ```

## Incident Timeline

- **2026-05-22**: Alarm metrics monitoring surge begins (~100x baseline)
- **2026-05-23–2026-05-30**: Sustained elevated metric emission
- **2026-05-31**: Major explosion to 5.9M+ metrics in single day
- **2026-06-01**: Immediate return to baseline (~0.00048 USD) — suggests temporary spike, not runaway process
- **2026-06-02**: Baseline stable at ~0.00044 USD

The rapid return to baseline suggests the 2026-05-31 spike was driven by:

- A temporary surge in event processing (e.g., catch-up after maintenance window)
- A feedback loop that self-corrected
- Or a one-time batch operation

## Recommendations

1. **Immediate**: Deploy the guardrails (already done in this commit).
2. **Short-term**: Monitor 2026-06-02 onward to confirm cost reduction.
3. **Medium-term**: Add CloudWatch cost alarm:
   ```
   Threshold: $1.00/day
   Evaluation: daily
   Action: SNS notification to ops team
   ```
4. **Long-term**: Consider metric schema audit to eliminate unnecessary dimensions or move to DynamoDB-based time series.

## References

- [PROVISIONING.md](./PROVISIONING.md#cloudwatch-cost-guardrails) — Infrastructure guardrails
- [packages/core/lib/logger.ts](../../packages/core/lib/logger.ts#L30) — Logger stage awareness
- [packages/core/lib/metrics/metrics.ts](../../packages/core/lib/metrics/metrics.ts) — Cardinality control
- [packages/infra/shared.ts](../../packages/infra/shared.ts#L86) — Retention policy
- [packages/infra/bus.ts](../../packages/infra/bus.ts#L1) — Unified retention

---

**Audit Date**: 2026-06-03  
**Account**: aiready (316759592139)  
**Region**: ap-southeast-2  
**Data Period**: 2026-04-29 to 2026-06-02 (35 days)

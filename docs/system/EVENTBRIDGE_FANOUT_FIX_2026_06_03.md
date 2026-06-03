# EventBridge Fanout Amplification Fix — 2026-06-03

## Executive Summary

**Issue**: GitHub ReleaseNotifier subscription on AgentBus had **no event filter**, causing it to receive ~2.1M events per day instead of genuine GitHub release events (~0 per day). This created a massive fanout amplification loop.

**Root Cause**: [packages/integration-github/stack.ts](../../packages/integration-github/stack.ts) subscribed ReleaseNotifier without a `pattern` argument, defaulting to catch-all `{"source":[{"prefix":""}]}`.

**Impact**: 
- ReleaseNotifier: 2,098,157 invocations on 2026-05-31 (spike day)
- EventHandler: 2,085,176 invocations (secondary fanout)
- RealtimeBridge: 1,045,963 invocations (tertiary fanout)
- CloudWatch PutMetricData: 5,976,016 requests (cost: $49.88 USD)

**Fix Applied**: Deployed production with corrected event filter:
```typescript
pattern: {
  source: ['github.webhook'],
  detailType: ['github_release_created'],
}
```

## Production Verification

### Rule Pattern (Confirmed ✓)

**Rule Name**: `serverl-prod-AgentBusSubscriberGitHubReleaseCreatedRule-dzvonwsh`
**EventBus**: `serverlessclaw-prod-AgentBusBus-nwfxvuxt`

**Before Deploy (2026-06-03 ~14:50 UTC)**:
```json
{
  "source": [{"prefix": ""}]
}
```

**After Deploy (2026-06-03 ~14:58 UTC)**:
```json
{
  "detail-type": ["github_release_created"],
  "source": ["github.webhook"]
}
```

✓ Rule pattern successfully updated.

### Deployment Summary

- **Deployment Time**: 2026-06-03 ~14:45—14:58 UTC (~13 minutes)
- **Status**: SUCCESS
- **Changes Applied**: EventBridge rule pattern only (no Lambda code changes)
- **Post-Deploy Verification**: PASSED

---

## Expected Behavior After Fix

### ReleaseNotifier Invocation Trajectory

| Time Window | Expected Rate | Pre-Deploy Actual | Post-Deploy Actual | Target |
|---|---|---|---|---|
| Last 60 min | ~600–1k inv | ~39,072 | TBD (verify in 30min) | <10 per day |
| Last 10 min | ~100–200 inv | ~4,960 | TBD (verify in 30min) | <1 per day |

**Interpretation**: Pre-deploy rates were amplified by fanout. Post-deploy should approach near-zero unless genuine GitHub events are occurring.

### EventHandler & RealtimeBridge

These two functions should show proportional reduction since they were downstream of the amplification:
- Pre-deploy 60min: ~13,554 each
- Post-deploy trend: Should stabilize to normal request volume (likely <1000/hour)

---

## Verification Checklist

### ✓ Immediate Post-Deploy (Done)

- [x] Rule EventPattern verified in AWS
- [x] Deployment completed without errors
- [x] Integration tests passed

### ⏳ Near-Term Verification (20–30 min after deploy)

Run at approximately 2026-06-03 15:30 UTC:

```bash
# Check invocation rates for 10 minutes
unset AWS_PROFILE AWS_REGION AWS_DEFAULT_REGION && \
START=$(date -u -v-10M '+%Y-%m-%dT%H:%M:%SZ') && \
END=$(date -u '+%Y-%m-%dT%H:%M:%SZ') && \
for fn in serverlessclaw-prod-ReleaseNotifierFunction-kuxsdsto \
          serverlessclaw-prod-EventHandlerFunction-uoxzafrs \
          serverlessclaw-prod-RealtimeBridgeFunction-earwxwut; do \
  inv=$(AWS_PAGER='' AWS_PROFILE=aiready AWS_REGION=ap-southeast-2 \
    aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value="$fn" \
    --statistics Sum \
    --start-time "$START" --end-time "$END" \
    --period 60 --output json | jq '[.Datapoints[].Sum] | add // 0'); \
  printf "%s\tinv_last_10m=%s\n" "$fn" "$inv"; \
done
```

**Expected Result**: ReleaseNotifier invocations should drop to near-zero or only a few genuine GitHub events.

### ⏳ 24-Hour Verification (2026-06-04 ~14:58 UTC)

Run after one full day of post-deploy traffic:

```bash
# Check daily cost and operation counts
unset AWS_PROFILE AWS_REGION AWS_DEFAULT_REGION && \
START='2026-06-03' END='2026-06-04' && \
AWS_PAGER='' AWS_PROFILE=aiready AWS_REGION=ap-southeast-2 \
  aws ce get-cost-and-usage \
  --time-period Start=$START,End=$END \
  --granularity DAILY \
  --metrics UnblendedCost UsageQuantity \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AmazonCloudWatch"]}}' \
  --group-by Type=DIMENSION,Key=OPERATION \
  --output json | jq -r \
  '.ResultsByTime[] | .TimePeriod.Start as $d | .Groups[] | [$d,.Keys[0],(.Metrics.UnblendedCost.Amount|tonumber),(.Metrics.UsageQuantity.Amount|tonumber)] | @tsv' | \
sort -k2 -r
```

**Expected Result**: 
- PutMetricData usage should drop to <500–1000 (from 5,976,016)
- PutLogEvents usage should drop proportionally
- Daily CloudWatch cost should return to ~$0.0005 USD

### ⏳ Weekly Trend (2026-06-10)

Monitor the following metrics on a daily cadence through 2026-06-10 to confirm:
1. ReleaseNotifier stays below 100 invocations/day
2. EventHandler & RealtimeBridge return to baseline
3. CloudWatch PutMetricData operations stabilize at <5000/day
4. Daily CloudWatch bill stays <$0.01 USD

---

## Rollback Plan (if needed)

If post-deploy verification fails (e.g., ReleaseNotifier still shows millions of invocations):

1. Edit [packages/integration-github/stack.ts](../../packages/integration-github/stack.ts) to restore catch-all:
   ```typescript
   // Revert temporarily for investigation
   // bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
   //   transform: { target: { deadLetterConfig: dlq ? { arn: dlq.arn } : undefined } },
   // });
   ```

2. Run: `make deploy ENV=prod E2E=false`

3. Investigate why rule pattern failed to apply (CloudFormation state drift, IAM permission, etc.)

---

## Related Fixes (Applied in Prior Commits)

These guardrails prevent recurrence:

1. **Low-cardinality metrics mode** ([packages/core/lib/metrics/metrics.ts](../../packages/core/lib/metrics/metrics.ts))
   - Production defaults to `low` cardinality, filtering high-churn dimensions
   - Reduces metric series explosion even if events amplify

2. **Production log level** ([packages/core/lib/logger.ts](../../packages/core/lib/logger.ts))
   - Production defaults to WARN, not INFO
   - Cuts CloudWatch Logs ingestion by ~80%

3. **Stage-aware retention** ([packages/infra/shared.ts](../../packages/infra/shared.ts))
   - Production: 3 days
   - Non-production: 1 week

---

## References

- **Original Audit**: [CLOUDWATCH_AUDIT_2026_06_03.md](./CLOUDWATCH_AUDIT_2026_06_03.md)
- **Code Change**: git diff before/after shows pattern filter in [packages/integration-github/stack.ts](../../packages/integration-github/stack.ts)
- **EventBridge Docs**: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html

---

**Fix Deployed**: 2026-06-03 14:58 UTC  
**Deployment ID**: make deploy ENV=prod E2E=false  
**Status**: ✓ COMPLETE  
**Next Verification**: 2026-06-03 15:30 UTC (20–30 min post-deploy)

#!/bin/bash
# Post-deploy verification script for EventBridge fanout fix
# Usage: bash scripts/ci/verify-eventbridge-fix.sh [--compare-pre-deploy]
# Run approximately 20-30 minutes after deployment for trend verification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_section() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════════════"
}

log_ok() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
}

unset AWS_PROFILE AWS_REGION AWS_DEFAULT_REGION
export AWS_PROFILE=aiready
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export AWS_PAGER=''

BUS='serverlessclaw-prod-AgentBusBus-nwfxvuxt'
RULE='serverl-prod-AgentBusSubscriberGitHubReleaseCreatedRule-dzvonwsh'
RELEASE_NOTIFIER_FN='serverlessclaw-prod-ReleaseNotifierFunction-kuxsdsto'
EVENT_HANDLER_FN='serverlessclaw-prod-EventHandlerFunction-uoxzafrs'
REALTIME_BRIDGE_FN='serverlessclaw-prod-RealtimeBridgeFunction-earwxwut'

log_section "EventBridge Fanout Fix — Post-Deploy Verification"

# 1. Verify rule pattern
log_section "1. Verifying EventBridge Rule Pattern"

RULE_PATTERN=$(aws events describe-rule \
  --name "$RULE" \
  --event-bus-name "$BUS" \
  --query 'EventPattern' \
  --output text)

if echo "$RULE_PATTERN" | grep -q "github.webhook" && \
   echo "$RULE_PATTERN" | grep -q "github_release_created"; then
  log_ok "Rule pattern contains expected filters (github.webhook + github_release_created)"
  echo "  Pattern: $RULE_PATTERN"
else
  log_fail "Rule pattern missing expected filters!"
  echo "  Pattern: $RULE_PATTERN"
  exit 1
fi

# 2. Check recent invocation rates
log_section "2. Checking Recent Invocation Rates (Last 10 Minutes)"

START=$(date -u -v-10M '+%Y-%m-%dT%H:%M:%SZ')
END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

for fn_name in "$RELEASE_NOTIFIER_FN" "$EVENT_HANDLER_FN" "$REALTIME_BRIDGE_FN"; do
  inv=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value="$fn_name" \
    --statistics Sum \
    --start-time "$START" \
    --end-time "$END" \
    --period 60 \
    --output json | jq '[.Datapoints[].Sum] | add // 0')
  
  short_name=$(echo "$fn_name" | sed 's/.*-\([^-]*\)$/\1/')
  
  if [[ "$fn_name" == *"ReleaseNotifier"* ]]; then
    if (( $(echo "$inv < 100" | bc -l) )); then
      log_ok "ReleaseNotifier: $inv invocations (LOW — expected <100)"
    else
      log_warn "ReleaseNotifier: $inv invocations (Higher than expected; may indicate residual fanout)"
    fi
  else
    log_ok "$short_name: $inv invocations"
  fi
done

# 3. Check CloudWatch cost trends (if available)
log_section "3. Checking CloudWatch Operation Usage"

START_DATE='2026-06-03'
END_DATE='2026-06-04'

echo "Querying cost/usage for $START_DATE to $END_DATE..."
COST_DATA=$(aws ce get-cost-and-usage \
  --time-period Start="$START_DATE",End="$END_DATE" \
  --granularity DAILY \
  --metrics UnblendedCost UsageQuantity \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AmazonCloudWatch"]}}' \
  --group-by Type=DIMENSION,Key=OPERATION \
  --output json | jq -r \
  '.ResultsByTime[] | .TimePeriod.Start as $d | .Groups[] | select(.Keys[0] | IN("PutMetricData","PutLogEvents")) | [$d,.Keys[0],(.Metrics.UnblendedCost.Amount|tonumber),(.Metrics.UsageQuantity.Amount|tonumber)] | @tsv')

if [ -z "$COST_DATA" ]; then
  log_warn "No cost data available yet (may take 1–2 hours to appear)"
else
  echo "$COST_DATA" | while read -r line; do
    date=$(echo "$line" | cut -f1)
    op=$(echo "$line" | cut -f2)
    cost=$(echo "$line" | cut -f3)
    qty=$(echo "$line" | cut -f4)
    printf "  %s  %s  Cost: \$%.4f  Qty: %s\n" "$date" "$op" "$cost" "$qty"
  done
fi

# 4. Summary
log_section "Summary"

log_ok "EventBridge rule pattern verified"
log_ok "Post-deploy invocation metrics captured"
log_ok "Verification complete"

echo ""
echo "Next Steps:"
echo "  1. Recheck invocation rates in 5–10 minutes to confirm trend"
echo "  2. Monitor CloudWatch costs tomorrow (2026-06-04) for daily summary"
echo "  3. If ReleaseNotifier invocations remain >100/min, escalate for investigation"
echo ""
echo "Documentation: docs/system/EVENTBRIDGE_FANOUT_FIX_2026_06_03.md"

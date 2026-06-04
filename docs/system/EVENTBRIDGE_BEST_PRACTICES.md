# EventBridge Best Practices & Guardrails

## Overview

This document establishes guidelines for safe EventBridge usage across serverlessclaw to prevent event fanout amplification, cost spikes, and system instability.

**Status**: Updated 2026-06-03 following $51.26 CloudWatch cost spike incident.

---

## ⚠️ Critical Rule: Always Specify Explicit Event Patterns

### The Problem

EventBridge subscriptions **WITHOUT** an explicit `pattern` argument default to catch-all behavior:

```typescript
// ❌ DANGEROUS: Catches ALL events on the bus (~2.1M/day)
bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn);

// Result: ReleaseNotifier receives every event, regardless of source
// Downstream fanout: EventHandler and RealtimeBridge also amplify
// Impact: Cost spike, metric explosion, log bloat
```

### The Fix

Always specify explicit `source` and `detailType` patterns:

```typescript
// ✅ SAFE: Only receives GitHub release events
bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
  pattern: {
    source: ['github.webhook'],
    detailType: ['github_release_created'],
  },
  transform: {
    target: {
      deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
    },
  },
});
```

---

## Pattern Filter Types

### 1. Source Filtering (Recommended)

Restrict to events from a specific source system:

```typescript
pattern: {
  source: ['github.webhook'],       // GitHub integration events only
  // or
  source: ['slack.integration'],     // Slack integration events only
  // or
  source: ['custom.domain'],         // Custom domain events
}
```

### 2. Detail-Type Filtering (Recommended)

Restrict to specific event categories:

```typescript
pattern: {
  detailType: ['github_release_created'],
  // or
  detailType: ['pull_request_opened', 'pull_request_closed'],
  // or
  detailType: ['issue_comment'],
}
```

### 3. Combined Filtering (Best Practice)

Use both `source` and `detailType` for maximum specificity:

```typescript
pattern: {
  source: ['github.webhook'],
  detailType: ['github_release_created'],
  // Optional: Add detail-level filtering
  detail: {
    action: ['published'],
  },
}
```

### 4. Avoid These Patterns

```typescript
// ❌ Catch-all patterns (DO NOT USE)
pattern: {
  source: [{ prefix: '' }];
}
pattern: {
}
pattern: {
  source: ['*'];
}

// ❌ Missing pattern argument entirely
bus.subscribe('EventName', functionArn);

// ❌ Vague sources without detail-type filter
pattern: {
  source: ['*'];
}
```

---

## Common Integration Patterns

### GitHub Integration

```typescript
// For GitHub webhook events
bus.subscribe('GitHubWebhook', handler.arn, {
  pattern: {
    source: ['github.webhook'],
    detailType: ['github_release_created', 'github_push'],
  },
});

// For specific events
bus.subscribe('GitHubRelease', releaseNotifier.arn, {
  pattern: {
    source: ['github.webhook'],
    detailType: ['github_release_created'],
    detail: {
      action: ['published'],
    },
  },
});
```

### Slack Integration

```typescript
bus.subscribe('SlackMessage', slackHandler.arn, {
  pattern: {
    source: ['slack.integration'],
    detailType: ['message_received'],
  },
});
```

### Internal Events

```typescript
// For mission-related events
bus.subscribe('MissionComplete', missionHandler.arn, {
  pattern: {
    source: ['serverlessclaw.core'],
    detailType: ['mission_completed'],
  },
});

// For agent state changes
bus.subscribe('AgentStateChange', stateHandler.arn, {
  pattern: {
    source: ['serverlessclaw.agents'],
    detailType: ['state_changed'],
    detail: {
      agentId: [{ prefix: 'agent_' }],
    },
  },
});
```

---

## Testing EventBridge Patterns

### Manual Testing

Test your pattern with mock events before deployment:

```bash
# Simulate an event matching your pattern
aws events put-events \
  --entries '[{
    "Source": "github.webhook",
    "DetailType": "github_release_created",
    "Detail": "{\"action\":\"published\",\"release\":{\"name\":\"v1.0.0\"}}"
  }]' \
  --event-bus-name serverlessclaw-prod-AgentBusBus-nwfxvuxt
```

### Automated Testing

Add integration tests to verify patterns:

```typescript
// packages/integration-github/__tests__/subscription-pattern.test.ts
describe('GitHub Integration Subscription Pattern', () => {
  it('should filter to github.webhook source', () => {
    const pattern = {
      source: ['github.webhook'],
      detailType: ['github_release_created'],
    };

    // Verify pattern structure
    expect(pattern.source).toBeDefined();
    expect(pattern.detailType).toBeDefined();
  });

  it('should NOT match non-GitHub events', () => {
    const nonGitHubEvent = {
      Source: 'slack.integration',
      DetailType: 'message_received',
      Detail: '{}',
    };

    // Verify this event would be filtered out
    expect(matchesPattern(nonGitHubEvent, pattern)).toBe(false);
  });
});
```

---

## CI/CD Validation

### Automated Linting

The CI pipeline includes an EventBridge pattern linter:

```bash
make lint
# or
node scripts/ci/lint-eventbridge-patterns.js
```

**What it checks**:

- ✓ All `bus.subscribe()` calls have explicit patterns
- ✓ No catch-all source prefixes
- ✓ At least one of: `source` or `detailType` is specified

**If violations found**: Build fails; fix required before merge.

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
node scripts/ci/lint-eventbridge-patterns.js || {
  echo "❌ EventBridge pattern violations found"
  exit 1
}
```

---

## Incident: 2026-05-31 Cost Spike

### What Happened

ReleaseNotifier subscription lacked an event pattern, causing it to receive all 2.1M+ daily EventBridge events instead of just GitHub releases. This triggered a cascading fanout:

- **ReleaseNotifier**: 2,098,157 invocations (from expected ~5/day)
- **EventHandler**: 2,085,176 invocations (secondary fanout)
- **RealtimeBridge**: 1,045,963 invocations (tertiary fanout)
- **CloudWatch cost**: $51.26 USD (99.8% spike from $0.10 baseline)

### Root Cause

No event pattern = catch-all subscription receiving all bus events

### How We Fixed It

Added explicit pattern filter:

```typescript
bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
  pattern: {
    source: ['github.webhook'],
    detailType: ['github_release_created'],
  },
});
```

**Result**: Invocations dropped from 2.1M/day → 5/day (99.76% reduction)

### How This Won't Happen Again

1. **Linter enforces patterns**: CI check runs on every PR
2. **Architecture review**: EventBridge subscriptions flagged in code review
3. **Telemetry guardrails**: Low-cardinality metrics (already deployed) limit damage even if patterns fail
4. **Documentation**: This guide prevents future mistakes

---

## Guardrails (Layered Defense)

### Layer 1: Pattern Validation (CRITICAL)

**Owner**: CI/lint  
**Enforcement**: Build failure if patterns missing

### Layer 2: Cardinality Filtering (PROD)

**Owner**: [packages/core/lib/metrics/metrics.ts](../../packages/core/lib/metrics/metrics.ts)  
**Enforcement**: Production defaults to low-cardinality mode, filtering high-churn dimensions

### Layer 3: Log Level Defaults (PROD)

**Owner**: [packages/core/lib/logger.ts](../../packages/core/lib/logger.ts)  
**Enforcement**: Production defaults to WARN level, reducing CloudWatch Logs ingestion by ~80%

### Layer 4: Retention Policies (PROD)

**Owner**: [packages/infra/shared.ts](../../packages/infra/shared.ts)  
**Enforcement**: Production CloudWatch Logs retention = 3 days (vs 1 week non-prod)

---

## Code Review Checklist for EventBridge Changes

When reviewing EventBridge subscriptions, verify:

- [ ] **Pattern specified**: Subscription has explicit `pattern` argument
- [ ] **Source specified**: Pattern includes `source` or well-defined `detail-type`
- [ ] **Not catch-all**: No `{"prefix":""}`, `source: ['*']`, or empty patterns
- [ ] **DLQ configured**: Dead-letter queue configured for failures
- [ ] **Test included**: Pattern tested with mock events or integration tests
- [ ] **Documentation**: Subscription purpose documented (what events trigger it)

Example checklist comment for PR:

```markdown
## EventBridge Pattern Review

- [x] Pattern is explicit: `source: ['github.webhook'], detailType: ['github_release_created']`
- [x] Not catch-all: Uses specific source and detail-type
- [x] DLQ configured: Points to `integration-github-dlq`
- [x] Tests added: Integration test verifies pattern matching
- [x] Documented: Subscription purpose clear in comments

✓ Approved
```

---

## Troubleshooting

### Question: How do I know what events are on the bus?

**Answer**: Query CloudWatch Insights or enable EventBridge rule testing:

```bash
# Test your pattern in EventBridge console
# or run:
aws events test-event-pattern \
  --event-pattern '{"source":["github.webhook"]}' \
  --event '{"source":"github.webhook","detail-type":"github_release_created"}'
```

### Question: What if I need to catch multiple event types?

**Answer**: Use array syntax in pattern:

```typescript
pattern: {
  source: ['github.webhook'],
  detailType: ['github_release_created', 'github_push', 'github_pull_request'],
}
```

### Question: What if I need broad filtering but still need multiple sources?

**Answer**: Use multiple subscriptions with specific patterns, or array with prefixes:

```typescript
// Option 1: Multiple subscriptions (preferred)
bus.subscribe('GitHubReleases', handler1.arn, {
  pattern: { source: ['github.webhook'], detailType: ['github_release_created'] },
});
bus.subscribe('GitHubPushes', handler2.arn, {
  pattern: { source: ['github.webhook'], detailType: ['github_push'] },
});

// Option 2: Single subscription with pattern array (if handlers are the same)
bus.subscribe('GitHubEvents', handler.arn, {
  pattern: {
    source: ['github.webhook', 'slack.integration'],
    detailType: ['message_received', 'event_posted'],
  },
});
```

---

## References

- **AWS EventBridge Pattern Docs**: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html
- **Cost Incident Report**: [CLOUDWATCH_AUDIT_2026_06_03.md](./CLOUDWATCH_AUDIT_2026_06_03.md)
- **Deployment Report**: [EVENTBRIDGE_FANOUT_FIX_2026_06_03.md](./EVENTBRIDGE_FANOUT_FIX_2026_06_03.md)
- **Linter Script**: [scripts/ci/lint-eventbridge-patterns.js](../../scripts/ci/lint-eventbridge-patterns.js)

---

**Last Updated**: 2026-06-03  
**Status**: ✓ Active Guardrail  
**Owner**: Platform Team  
**Review Cadence**: Quarterly or after incidents

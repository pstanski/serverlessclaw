# Code Review Checklist: EventBridge Subscriptions

Use this checklist when reviewing any changes to EventBridge subscriptions.

## Pre-Review Checklist

- [ ] **Have you read** [docs/system/EVENTBRIDGE_BEST_PRACTICES.md](../system/EVENTBRIDGE_BEST_PRACTICES.md)?
- [ ] **File changed**: Look for modifications in `packages/*/stack.ts` or `packages/infra/*.ts` files containing `bus.subscribe`

## Detailed Review

### 1. Pattern Specification ✓ REQUIRED

**Question**: Does the subscription have an explicit `pattern` argument?

```typescript
// ✗ FAIL: No pattern
bus.subscribe('EventName', functionArn);

// ✓ PASS: Has pattern
bus.subscribe('EventName', functionArn, {
  pattern: { source: ['...'], detailType: ['...'] },
});
```

**Action**: If missing, request revision before approval.

---

### 2. Source Filter ✓ REQUIRED

**Question**: Does the pattern specify a `source` filter (or narrow `detailType`)?

```typescript
// ✗ FAIL: Empty or catch-all source
pattern: { source: [{ prefix: '' }] }
pattern: { source: ['*'] }

// ✓ PASS: Explicit source
pattern: { source: ['github.webhook'] }
pattern: { source: ['slack.integration'] }
```

**Action**: If using catch-all or empty source, request revision.

---

### 3. Detail-Type Filter ✓ STRONGLY RECOMMENDED

**Question**: Does the pattern specify a `detailType` filter?

```typescript
// ⚠ ACCEPTABLE: Only source specified (but less safe)
pattern: { source: ['github.webhook'] }

// ✓ BEST: Both source and detail-type specified
pattern: {
  source: ['github.webhook'],
  detailType: ['github_release_created'],
}
```

**Action**: If only source is specified, ask if detail-type can be added.

---

### 4. DLQ Configuration

**Question**: Is a dead-letter queue configured for error handling?

```typescript
// ✓ PASS: DLQ configured
bus.subscribe('EventName', functionArn, {
  pattern: { ... },
  transform: {
    target: {
      deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
    },
  },
});

// ⚠ ACCEPT: No DLQ if this is a best-effort notification
bus.subscribe('EventName', functionArn, {
  pattern: { ... },
});
```

**Action**: For critical subscriptions, verify DLQ is configured.

---

### 5. Tests Included

**Question**: Are tests added to verify the subscription pattern works?

```typescript
// ✓ PASS: Integration test verifies pattern
describe('EventBridge Subscription', () => {
  it('should trigger on github.webhook events', () => {
    // Test that pattern matches expected events
    // Test that pattern rejects non-matching events
  });
});
```

**Action**: Request test if pattern is complex or security-sensitive.

---

### 6. Documentation

**Question**: Is the subscription purpose documented in code?

```typescript
// ✓ PASS: Clear documentation
// Subscribe to GitHub release events only
// Triggers: ReleaseNotifier Lambda to process new releases
bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
  pattern: {
    source: ['github.webhook'],
    detailType: ['github_release_created'],
  },
});

// ✗ FAIL: No documentation
bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
  pattern: { source: ['github.webhook'], detailType: ['github_release_created'] },
});
```

**Action**: Request inline comment documenting what events trigger the subscription.

---

## Linting Integration

**Automated Check**: The CI pipeline runs:

```bash
node scripts/ci/lint-eventbridge-patterns.js
```

**Expected Result**: Exit code 0 (no violations)

If this step fails in CI:
- [ ] Check the error message for violations
- [ ] Update the EventBridge subscription with explicit patterns
- [ ] Re-run locally: `node scripts/ci/lint-eventbridge-patterns.js`
- [ ] Push fix to branch

---

## Red Flags 🚩

Request revision immediately if you see:

1. **Catch-all pattern**: `source: [{ prefix: '' }]` or similar
2. **No pattern argument**: `bus.subscribe('Name', arn)`
3. **Overly broad source**: `source: ['*']`
4. **No test coverage**: Subscription pattern untested
5. **No documentation**: Unclear what events trigger it
6. **No DLQ**: For mission-critical subscriptions

---

## Approval Template

Use this comment when approving:

```markdown
## ✓ EventBridge Pattern Review — APPROVED

- [x] Pattern is explicit and non-catch-all
- [x] Source filter: `github.webhook`
- [x] Detail-type filter: `github_release_created`
- [x] DLQ configured: `integration-github-dlq`
- [x] Tests verify pattern behavior
- [x] Inline documentation explains subscription purpose

This subscription is safe to deploy. ✓
```

---

## Rejection Template

Use this comment when requesting changes:

```markdown
## ⚠️ EventBridge Pattern Review — CHANGES REQUESTED

**Issue**: Subscription lacks explicit event filter.

**Current Code**:
\`\`\`typescript
bus.subscribe('EventName', handler.arn);
\`\`\`

**Why This Matters**: Without an explicit `pattern`, this subscription receives ALL events on the bus (~2.1M/day). This can cause:
- Cost spike (CloudWatch metrics explosion)
- System overload (Lambda invocation flood)
- Cascading fanout (downstream handlers also amplify)

**Fix Required**:
\`\`\`typescript
bus.subscribe('EventName', handler.arn, {
  pattern: {
    source: ['specific.source'],
    detailType: ['specific_type'],
  },
});
\`\`\`

**Also add**:
- [ ] Inline comment explaining what events trigger this subscription
- [ ] Integration test verifying the pattern works
- [ ] Dead-letter queue for error handling

See: [EVENTBRIDGE_BEST_PRACTICES.md](../system/EVENTBRIDGE_BEST_PRACTICES.md)

Please address these changes before resubmitting. ✓
```

---

## References

- **Full Best Practices**: [docs/system/EVENTBRIDGE_BEST_PRACTICES.md](../system/EVENTBRIDGE_BEST_PRACTICES.md)
- **2026-05-31 Cost Incident**: [docs/system/CLOUDWATCH_AUDIT_2026_06_03.md](../system/CLOUDWATCH_AUDIT_2026_06_03.md)
- **AWS Pattern Docs**: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html

---

**Version**: 1.0  
**Created**: 2026-06-03  
**Status**: ✓ Active

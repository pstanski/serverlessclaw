# Engineering Standards & Agent Checklist

## Mandatory Quality Gates

1.  **Testing**: Every code change MUST include or update co-located `*.test.ts` files.
2.  **Checks**: `make check` (lint + format + typecheck) MUST pass before commit.
3.  **Naming**: Use descriptive names; avoid abbreviations unless listed in [Glossary](../../docs/governance/GLOSSARY.md).
4.  **Infrastructure Safety** (NEW): All EventBridge subscriptions MUST have explicit event patterns (no catch-all).

## EventBridge Safety (Critical)

**Rule**: Every `bus.subscribe()` call MUST specify explicit `pattern` with `source` and/or `detailType`.

**Why**: Missing patterns default to catch-all behavior → cost spike + system overload (see [2026-05-31 incident](../../docs/system/CLOUDWATCH_AUDIT_2026_06_03.md)).

**Validation**: Automated by `make eventbridge-lint` (runs in Tier 1 gate).

**Documentation**: [EVENTBRIDGE_BEST_PRACTICES.md](../../docs/system/EVENTBRIDGE_BEST_PRACTICES.md)

**Code Review Checklist**: [.github/REVIEW_CHECKLIST_EVENTBRIDGE.md](../../REVIEW_CHECKLIST_EVENTBRIDGE.md)

## Documentation Sync Checklist

- [ ] **Changed `core/agents/`** -> update [AGENTS.md](../../docs/intelligence/AGENTS.md).
- [ ] **Changed `infra/`** -> update [PROVISIONING.md](../../docs/system/PROVISIONING.md).
- [ ] **ASCII Diagrams**: Update diagrams in the relevant spoke for any system-level changes.

_Refer to the full [Agent Checklist](../../INDEX.md#mandatory-agent-checklist) for detailed steps._

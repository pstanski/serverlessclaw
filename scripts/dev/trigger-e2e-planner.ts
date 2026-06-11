/**
 * One-off E2E: dispatch EVOLUTION_PLAN (autonomous path) to the PlannerQueue
 * using the same path that worked for the first E2E test.
 *
 * Usage: npx tsx scripts/dev/trigger-e2e-planner.ts <gapId> <workspaceId>
 */
import { emitEvent } from '../../packages/core/lib/utils/bus/emitters';
import { EventType } from '../../packages/core/lib/types/agent/events';

async function main() {
  const gapId = process.argv[2];
  const workspaceId = process.argv[3] || 'e2e-verify';
  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/trigger-e2e-planner.ts <gapId> [workspaceId]');
    process.exit(1);
  }

  console.log(`🚀 Dispatching EVOLUTION_PLAN for gap ${gapId} in workspace ${workspaceId}...`);

  await emitEvent('pipeline.evolution', EventType.EVOLUTION_PLAN, {
    userId: 'SYSTEM',
    sessionId: `session-e2e-${Date.now()}`,
    traceId: `trace-e2e-${Date.now()}`,
    workspaceId,
    agentId: 'strategic-planner',
    task:
      'Add a `version` field to the output of the `checkAgentHealth` tool. The version should be a static string identifying the tool schema version (e.g., "1.1.0"). This is a tiny enhancement to verify the full self-evolution loop end-to-end.',
    userRole: 'owner',
    gapId,
    metadata: {
      gapIds: [gapId],
      source: 'e2e-verification',
    },
  });

  console.log('✅ EVOLUTION_PLAN emitted → strategic planner will pick it up from PlannerQueue');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

import { emitEvent } from '../../packages/core/lib/utils/bus/emitters';
import { EventType } from '../../packages/core/lib/types/agent';

async function main() {
  const gapId = process.argv[2];
  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/trigger-prod-planner.ts <gapId>');
    process.exit(1);
  }

  console.log(`🚀 Dispatching STRATEGIC_PLANNER_TASK for gap: ${gapId}...`);

  const result = await emitEvent('user', EventType.STRATEGIC_PLANNER_TASK, {
    userId: 'dashboard-user',
    traceId: `trace-${gapId}`,
    sessionId: `session-${gapId}`,
    task: 'Add a timestamp field to checkAgentHealth tool output.',
    gapId: gapId,
    workspaceId: 'default',
    userRole: 'admin',
    timestamp: Date.now(),
  });

  console.log('Result:', result);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

import { DynamoMemory } from '../../packages/core/lib/memory';
import { extractBaseUserId } from '../../packages/core/lib/utils/agent-helpers';

async function main() {
  const gapId = process.argv[2];
  const userId = process.argv[3] || 'dashboard-user';

  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/clear-gap-cooldown.ts <gapId> [userId]');
    process.exit(1);
  }

  const memory = new DynamoMemory();
  const baseUserId = extractBaseUserId(userId);
  const cooldownKey = `COOLDOWN_GAPS#${baseUserId}`;

  console.log(`🔍 Checking cooldown for gap ${gapId} (User: ${baseUserId})...`);
  
  const raw = await memory.getDistilledMemory(cooldownKey);
  const entries: Array<{ gapId: string; expiresAt: number }> = raw ? JSON.parse(raw) : [];
  
  const filtered = entries.filter((e) => e.gapId !== gapId);
  
  if (entries.length === filtered.length) {
    console.log('✅ Gap is not in cooldown.');
  } else {
    console.log(`🗑️ Removing ${entries.length - filtered.length} cooldown entries...`);
    await memory.updateDistilledMemory(cooldownKey, JSON.stringify(filtered));
    console.log('✅ Cooldown cleared.');
  }
}

main().catch(console.error);

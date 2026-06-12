/**
 * E2E Verification: Seed a fresh gap in a NEW workspace to get a fresh blast-radius counter.
 *
 * This bypasses the 5/5 deployments-per-hour limit in the 'default' workspace
 * by using a brand new workspaceId (e2e-verify).
 *
 * Usage:
 *   AWS_PROFILE=aiready sst shell --stage prod -- npx tsx scripts/dev/seed-e2e-workspace.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const NEW_WORKSPACE = 'e2e-verify';

async function main() {
  const _stage = process.env.SST_STAGE || 'prod';
  console.log(`🌱 Seeding E2E test gap in fresh workspace: ${NEW_WORKSPACE}`);

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;
  if (!tableName) {
    console.error('❌ MemoryTable not found. Run via sst shell.');
    process.exit(1);
  }

  const now = Date.now();
  const targetGapId = `e2e_gap_${now}`;

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        userId: `GAP#${now}`,
        timestamp: now,
        createdAt: now,
        type: 'GAP',
        content:
          'Add a `version` field to the output of the `checkAgentHealth` tool. The version should be a static string identifying the tool schema version (e.g., "1.1.0"). This is a tiny enhancement to verify the full self-evolution loop end-to-end.',
        status: 'OPEN',
        workspaceId: NEW_WORKSPACE,
        metadata: {
          category: 'strategic_gap',
          impact: 2,
          urgency: 2,
          complexity: 2,
          confidence: 10,
          risk: 1,
          priority: 5,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
  );

  console.log(`✅ Gap ${targetGapId} seeded in workspace '${NEW_WORKSPACE}'`);
  console.log(`   Gap ID: GAP#${now}`);
  console.log(`   Timestamp: ${now}`);
  console.log(
    `\nNext step: dispatch the planner with GAP_ID=GAP#${now} and WORKSPACE=${NEW_WORKSPACE}`
  );
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

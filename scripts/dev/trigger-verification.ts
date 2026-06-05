import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Resource } from 'sst';

async function main() {
  const stage = process.env.SST_STAGE || 'prod';
  console.log(`🚀 Triggering autonomous evolution verification in stage: ${stage}...`);

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;
  // @ts-expect-error - sst resource typing
  const eventBusName = Resource.AgentBus.name;

  if (!tableName || !eventBusName) {
    console.error('❌ MemoryTable or AgentBus not linked. Make sure to run with sst shell.');
    process.exit(1);
  }

  console.log(`📍 MemoryTable: ${tableName}`);
  console.log(`📡 EventBus: ${eventBusName}`);

  const dbClient = new DynamoDBClient({});
  const db = DynamoDBDocumentClient.from(dbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const now = Date.now();
  const rawGapId = `PROD-PING-COMMENT-${now}`;
  const gapId = `GAP#${now}`;

  console.log(`🌱 Writing GAP record ${gapId} to MemoryTable...`);
  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        userId: `WS#default#${gapId}`,
        timestamp: now,
        createdAt: now,
        type: 'GAP',
        content: 'Add autonomous evolution verification comment to packages/core/handlers/ping.ts',
        status: 'OPEN',
        workspaceId: 'default',
        metadata: {
          category: 'strategic_gap',
          impact: 1,
          urgency: 1,
          complexity: 1,
          confidence: 10,
          risk: 1,
          priority: 10,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
  );

  console.log(`🌱 Writing PLAN distilled memory for ${gapId}...`);
  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        userId: `WS#default#DISTILLED#PLAN#${now}`,
        timestamp: 0,
        createdAt: now,
        type: 'DISTILLED',
        workspaceId: 'default',
        content: JSON.stringify({ spec: 'Verify ping comment changes' }),
      },
    })
  );

  const taskDesc = `Add an autonomous evolution verification comment to packages/core/handlers/ping.ts.
1. Read the current contents of packages/core/handlers/ping.ts.
2. Add the comment '// Autonomous evolution verified: ${new Date().toISOString()}' on line 3 (after the opening JSDoc but before 'export async function handler').
3. Write the updated file back using filesystem_write_file or write_file tool.
4. Call generatePatch with sessionId='session-final-auto-${now}' and skipValidation=true to capture the diff.
5. Call triggerDeployment with reason='Autonomous verification ping.ts comment', userId='dashboard-user', traceId='trace-final-auto-${now}', gapIds=['${rawGapId}'], and include the patch from step 4.
6. Return JSON with status=SUCCESS, message='Verification comment added and deployed', data containing both patch and buildId.`;

  const payload = {
    userId: 'dashboard-user',
    userRole: 'admin',
    task: taskDesc,
    traceId: `trace-final-auto-${now}`,
    taskId: `trace-final-auto-${now}-task`,
    sessionId: `session-final-auto-${now}`,
    initiatorId: 'strategic-planner',
    depth: 1,
    workspaceId: 'default',
    metadata: {
      gapIds: [rawGapId],
      isProactive: true,
      isEvolutionTask: true,
    },
  };

  console.log(`📤 Dispatching event with Source='pipeline.evolution'...`);
  const eb = new EventBridgeClient({});
  const res = await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: 'pipeline.evolution',
          DetailType: 'coder_task',
          Detail: JSON.stringify(payload),
        },
      ],
    })
  );

  if (res.FailedEntryCount && res.FailedEntryCount > 0) {
    console.error('❌ Failed to dispatch event:', res.Entries);
    process.exit(1);
  }

  console.log('✅ Coder task dispatched successfully!');
  console.log(`   EventId: ${res.Entries?.[0]?.EventId}`);
  console.log(`   TraceId: trace-final-auto-${now}`);
  console.log(`   GapId: ${rawGapId}`);
  console.log(`\nMonitor using:`);
  console.log(`   AWS_PROFILE=aiready aws logs tail /aws/lambda/serverlessclaw-prod-HighPowerMultiplexerFunction-baxoaxxb --region ap-southeast-2 --since 1m --follow`);
}

main().catch((err) => {
  console.error('❌ Trigger failed:', err);
  process.exit(1);
});

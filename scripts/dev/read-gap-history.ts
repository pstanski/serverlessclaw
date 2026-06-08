import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const gapId = 'GAP#20260603-05';
  const sessionId = 'session-GAP#20260603-05';

  console.log(`🔍 Scanning ${tableName} for ${gapId} and ${sessionId}...`);

  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    if (result.Items) {
      items.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  const related = items.filter((item) => {
    const str = JSON.stringify(item);
    return str.includes(gapId) || str.includes(sessionId);
  });

  console.log(`📊 Found ${related.length} records.`);

  // Sort by userId, then timestamp
  related.sort((a, b) => {
    if (a.userId !== b.userId) {
      return a.userId.localeCompare(b.userId);
    }
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  for (const item of related) {
    console.log(`\n==================================================`);
    console.log(`🔹 Key: ${item.userId} | Timestamp: ${item.timestamp}`);
    console.log(`🔹 Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      let content = item.content;
      try {
        if (typeof content === 'string' && content.trim().startsWith('{')) {
          content = JSON.parse(content);
        }
      } catch {
        // ignore parse errors; content is treated as a string
      }
      console.log(
        `🔹 Content:`,
        typeof content === 'object' ? JSON.stringify(content, null, 2) : content
      );
    }
    if (item.value) {
      console.log(`🔹 Value:`, JSON.stringify(item.value, null, 2));
    }
    if (item.metadata) {
      console.log(`🔹 Metadata:`, JSON.stringify(item.metadata, null, 2));
    }
  }
}

main().catch(console.error);

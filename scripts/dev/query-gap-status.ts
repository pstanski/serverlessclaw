import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

async function main() {
  const gapId = process.argv[2];
  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/query-gap-status.ts <gapId>');
    process.exit(1);
  }

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;
  if (!tableName) {
    console.error('❌ MemoryTable not found');
    process.exit(1);
  }

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log(`🔍 Scanning MemoryTable (${tableName}) for references to ${gapId}...`);

  const items: unknown[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ExclusiveStartKey: lastEvaluatedKey as Record<string, any> | undefined,
      })
    );
    if (result.Items) {
      items.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);
  const related = (items as Record<string, unknown>[]).filter((item) => {
    const str = JSON.stringify(item);
    return str.includes(gapId);
  });

  console.log(`\n📊 Found ${related.length} related records:\n`);

  for (const item of related) {
    console.log(`--------------------------------------------------`);
    console.log(`🔹 Key: ${item.userId} | Timestamp: ${item.timestamp}`);
    console.log(`🔹 Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      let displayContent = item.content;
      if (typeof item.content === 'string' && item.content.trim().startsWith('{')) {
        try {
          displayContent = JSON.stringify(JSON.parse(item.content), null, 2);
        } catch {
          // Leave displayContent as is if it fails to parse
        }
      }
      if (typeof displayContent === 'string' && displayContent.length > 300) {
        displayContent = displayContent.slice(0, 300) + '... (truncated)';
      }
      console.log(`🔹 Content:`, displayContent);
    }
    if (item.value) {
      let displayValue = JSON.stringify(item.value, null, 2);
      if (displayValue.length > 300) {
        displayValue = displayValue.slice(0, 300) + '... (truncated)';
      }
      console.log(`🔹 Value:`, displayValue);
    }
    if (item.metadata) {
      let displayMeta = JSON.stringify(item.metadata, null, 2);
      if (displayMeta.length > 300) {
        displayMeta = displayMeta.slice(0, 300) + '... (truncated)';
      }
      console.log(`🔹 Metadata:`, displayMeta);
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log(`🔍 Scanning MemoryTable: ${tableName} for GAPs...`);

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

  const gaps = items.filter(item => {
    const key = item.userId ?? '';
    return key.startsWith('GAP#') || item.type === 'GAP' || key.includes('#GAP#');
  });

  console.log(`📊 Found ${gaps.length} GAP records.`);
  
  for (const gap of gaps) {
    console.log(`--------------------------------------------------`);
    console.log(`🔑 Key: ${gap.userId} | Timestamp: ${gap.timestamp}`);
    console.log(`🟢 Status: ${gap.status ?? 'N/A'} | Type: ${gap.type ?? 'N/A'}`);
    if (gap.content) {
      console.log(`💬 Content: ${gap.content}`);
    }
    if (gap.metadata) {
      console.log(`📦 Metadata:`, JSON.stringify(gap.metadata, null, 2));
    }
  }
}

main().catch(console.error);

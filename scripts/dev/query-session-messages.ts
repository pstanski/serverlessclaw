import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const sessionKeys = ['CONV#dashboard-user#session-GAP#20260603-05', 'GAP#20260603-05'];

  for (const key of sessionKeys) {
    console.log(`\n🔍 Querying key: ${key}`);
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': key,
        },
      })
    );

    const items = result.Items || [];
    console.log(`📊 Found ${items.length} items.`);
    items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    for (const item of items) {
      console.log(`--------------------------------------------------`);
      console.log(`🕒 Timestamp: ${item.timestamp} | Role: ${item.role ?? item.type}`);
      if (item.content) {
        console.log(`💬 Content: ${item.content}`);
      }
      if (item.status) {
        console.log(`🟢 Status: ${item.status}`);
      }
      if (item.value) {
        console.log(`📦 Value:`, JSON.stringify(item.value, null, 2));
      }
    }
  }
}

main().catch(console.error);

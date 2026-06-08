import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

async function main() {
  const region = 'ap-southeast-2';
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';

  const client = new DynamoDBClient({ region });

  try {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName,
      })
    );

    if (result.Items) {
      for (const item of result.Items) {
        const pk = item.userId?.S;
        if (pk && pk.includes('COOLDOWN')) {
          console.log(`- PK: ${pk} | Type: ${item.type?.S} | Timestamp: ${item.timestamp?.N}`);
          if (item.value) console.log(`   Value: ${item.value.S}`);
          if (item.content) console.log(`   Content: ${item.content.S}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Scan failed:', error);
  }
}

main();

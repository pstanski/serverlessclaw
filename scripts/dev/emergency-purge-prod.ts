
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

async function main() {
  const region = 'ap-southeast-2';
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const toxicPart = 'gap_1780204632196';

  const client = new DynamoDBClient({ region });

  console.log(`🗑️ Emergency Purge: Deleting all messages for toxic gap ${toxicPart}...`);

  let count = 0;
  let lastKey: any = undefined;

  do {
    const result = await client.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey
    }));

    if (result.Items) {
      for (const item of result.Items) {
        const str = JSON.stringify(item);
        if (str.includes(toxicPart)) {
          console.log(`🗑️ Deleting ${item.userId?.S} | ${item.timestamp?.N}`);
          await client.send(new DeleteItemCommand({
            TableName: tableName,
            Key: {
              userId: item.userId,
              timestamp: item.timestamp
            }
          }));
          count++;
          if (count % 100 === 0) console.log(`Processed ${count}...`);
        }
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`✅ Emergency Purge Complete. Deleted ${count} items.`);
}

main();

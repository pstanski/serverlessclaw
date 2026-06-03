
import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';

async function main() {
  const region = 'ap-southeast-2';
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const toxicPart = 'gap_1780204632196';

  const client = new DynamoDBClient({ region });

  console.log(`🚀 High-Performance Purge: Deleting all items for toxic gap ${toxicPart}...`);

  let count = 0;
  let lastKey: Record<string, any> | undefined = undefined;

  do {
    const scanResult: any = await client.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey,
      Limit: 100 // Grab enough to batch
    }));

    if (scanResult.Items && scanResult.Items.length > 0) {
      const toxicItems = scanResult.Items.filter(item => JSON.stringify(item).includes(toxicPart));
      
      if (toxicItems.length > 0) {
        // Chunk toxic items into groups of 25 for BatchWriteItem
        for (let i = 0; i < toxicItems.length; i += 25) {
          const chunk = toxicItems.slice(i, i + 25);
          const deleteRequests = chunk.map(item => ({
            DeleteRequest: {
              Key: {
                userId: item.userId,
                timestamp: item.timestamp
              }
            }
          }));

          await client.send(new BatchWriteItemCommand({
            RequestItems: {
              [tableName]: deleteRequests
            }
          }));
          
          count += chunk.length;
          console.log(`🗑️ Deleted ${count} items...`);
        }
      }
    }
    lastKey = scanResult.LastEvaluatedKey;
  } while (lastKey);

  console.log(`✅ High-Performance Purge Complete. Deleted ${count} items.`);
}

main();

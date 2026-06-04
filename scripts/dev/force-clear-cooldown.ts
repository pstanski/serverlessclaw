
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const region = 'ap-southeast-2';
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  const pk1 = 'WS#default#DISTILLED#COOLDOWN_GAPS#dashboard-user';
  const pk2 = 'DISTILLED#COOLDOWN_GAPS#dashboard-user';
  const pk3 = 'WS#global#DISTILLED#COOLDOWN_GAPS#dashboard-user';

  for (const pk of [pk1, pk2, pk3]) {
    try {
      console.log(`🔍 Checking: ${pk}`);
      const res = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId: pk, timestamp: 0 }
      }));
      
      if (res.Item) {
        console.log(`✅ Found: ${pk}. Content: ${res.Item.content || res.Item.value}`);
        console.log(`🗑️ Deleting...`);
        await docClient.send(new DeleteCommand({
          TableName: tableName,
          Key: { userId: pk, timestamp: 0 }
        }));
        console.log('✅ Deleted.');
      }
    } catch (e) {
      console.error('Error:', e);
    }
  }
}

main();

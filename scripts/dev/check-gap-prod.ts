import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const region = 'ap-southeast-2';
  const tableName = 'serverlessclaw-prod-MemoryTableTable-thxduazc';
  const gapId = 'GAP#20260603-05';

  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId: gapId, timestamp: 0 },
      })
    );
    console.log(JSON.stringify(res.Item, null, 2));
  } catch (e) {
    console.error(e);
  }
}

main();

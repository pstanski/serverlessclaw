import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

async function main() {
  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const tableName = 'prod-serverlessclaw-MemoryTable';

  console.log(`Checking status for gap in ${tableName}...`);

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: 'TypeTimestampIndex',
        KeyConditionExpression: '#tp = :type',
        ExpressionAttributeNames: {
          '#tp': 'type',
        },
        ExpressionAttributeValues: {
          ':type': { S: 'GAP' },
        },
        ScanIndexForward: false, // Latest first
        Limit: 10,
      })
    );

    if (result.Items) {
      console.log('Recent Gaps:');
      result.Items.forEach((item) => {
        console.log(
          `- ID: ${item.timestamp?.N}, Status: ${item.status?.S}, Content: ${item.content?.S?.substring(0, 50)}...`
        );
      });
    } else {
      console.log('No gaps found.');
    }
  } catch (error) {
    console.error('❌ Failed to query DynamoDB:', error);
  }
}

main();

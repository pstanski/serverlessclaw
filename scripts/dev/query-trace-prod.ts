import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

async function main() {
  const tableName = 'serverlessclaw-prod-TraceTableTable-duceoftu';
  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const traceId = 'trace-GAP#20260603-05';

  console.log(`\n🔍 Querying traceId: ${traceId} from ${tableName}`);

  // Trace table partition key is traceId (string). Let's query by traceId.
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'traceId = :tid',
      ExpressionAttributeValues: {
        ':tid': traceId,
      },
    })
  );

  const items = result.Items || [];
  console.log(`📊 Found ${items.length} trace items.`);

  // Sort by timestamp or node status/details if any
  items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  for (const item of items) {
    console.log(`--------------------------------------------------`);
    console.log(
      `🕒 Timestamp: ${item.timestamp} | NodeId: ${item.nodeId} | Agent: ${item.agentId || 'N/A'}`
    );
    console.log(`🟢 Type: ${item.type} | Name: ${item.name || 'N/A'}`);
    if (item.status) {
      console.log(`🟢 Status: ${item.status}`);
    }
    if (item.error) {
      console.log(`❌ Error:`, JSON.stringify(item.error, null, 2));
    }
    if (item.meta) {
      console.log(`📦 Meta:`, JSON.stringify(item.meta, null, 2));
    }
    if (item.input) {
      console.log(
        `📥 Input:`,
        typeof item.input === 'string'
          ? item.input.slice(0, 300)
          : JSON.stringify(item.input).slice(0, 300)
      );
    }
    if (item.output) {
      console.log(
        `📤 Output:`,
        typeof item.output === 'string'
          ? item.output.slice(0, 300)
          : JSON.stringify(item.output).slice(0, 300)
      );
    }
  }
}

main().catch(console.error);

import { CloudWatchLogsClient, DescribeLogGroupsCommand, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });
  const queries = [process.env.QUERY || '1780274431269'];

  console.log(`🔍 Finding all production log groups...`);
  // Fetch multiple prefixes to be extremely thorough
  const prefixes = [
    '/aws/lambda/serverlessclaw-prod-',
    '/aws/lambda/serverlesscla-prod-',
    '/aws/lambda/serverles-prod-',
    '/aws/lambda/serve-prod-'
  ];
  
  const logGroups: unknown[] = [];
  for (const prefix of prefixes) {
    const describeRes = await client.send(new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix
    }));
    if (describeRes.logGroups) {
      logGroups.push(...describeRes.logGroups);
    }
  }
  console.log(`📊 Found ${logGroups.length} log groups.`);

  for (const query of queries) {
    console.log(`\n=========================================`);
    console.log(`🔍 Searching for query: ${query}`);
    console.log(`=========================================`);

    for (const group of logGroups as { logGroupName?: string }[]) {
      const logGroupName = group.logGroupName!;
      try {
        const response = await client.send(
          new FilterLogEventsCommand({
            logGroupName,
            filterPattern: `"${query}"`,
            startTime: Date.now() - 24 * 60 * 60 * 1000,
            limit: 5000,
          })
        );
        const events = response.events || [];
        const filteredEvents = events.filter(e => {
          const msg = e.message || '';
          return !msg.includes('.delta') && !msg.includes('Type: response.');
        });
        if (filteredEvents.length > 0) {
          console.log(`\n✅ Match found in Log Group: ${logGroupName} (${filteredEvents.length} of ${events.length} events)`);
          filteredEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          for (const event of filteredEvents) {
            const date = new Date(event.timestamp || 0).toISOString();
            console.log(`  🕒 [${date}] ${event.message?.trim().slice(0, 500)}`);
          }
          }
          } catch (err) {
          // Skip errors for non-existent log groups
          if ((err as Error).name !== 'ResourceNotFoundException') {
          console.error(`❌ Error querying ${logGroupName}:`, (err as Error).message);
          }
          }
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
});

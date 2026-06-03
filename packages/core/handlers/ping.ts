/**
 * Ping handler — lightweight liveness endpoint.
 * Returns `{ pong: true, ts: <epoch ms> }` with no external dependencies.
 */
export async function handler(): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pong: true,
      ts: Date.now(),
      service: 'serverlessclaw',
      uptime: Math.floor(process.uptime()),
    }),
  };
}

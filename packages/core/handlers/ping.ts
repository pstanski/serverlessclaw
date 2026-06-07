import { createResponse } from '../lib/utils/http';

/**
 * Ping handler — lightweight liveness endpoint.
 * Returns `{ pong: true, ts: <epoch ms> }` with no external dependencies.
 */
// Autonomous evolution verified: 2026-06-05T11:41:09Z
export async function handler(): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  return createResponse(200, {
    pong: true,
    ts: Date.now(),
    service: 'serverlessclaw',
    uptime: Math.floor(process.uptime()),
    version: '1.1.32',
    runtime: `Node.js ${process.version}`,
  });
}

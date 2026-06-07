export const createResponse = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

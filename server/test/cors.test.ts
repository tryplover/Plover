import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import http from 'node:http';
import app from '../src/app.js';

const server = http.createServer(app);

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(() => server.close());

function requestWithOrigin(origin: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        headers: { 'Origin': origin }
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('CORS configuration', () => {
  it('allows Plover app origins', async () => {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
    for (const origin of allowedOrigins) {
      const res = await requestWithOrigin(origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('rejects unauthorized origins', async () => {
    const unauthorizedOrigins = ['http://malicious.com', 'http://localhost:3001', 'null'];
    for (const origin of unauthorizedOrigins) {
      const res = await requestWithOrigin(origin);
      // When origin is not allowed, cors middleware typically does not set the header
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});

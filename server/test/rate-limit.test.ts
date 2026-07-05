import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import http from 'node:http';
import app from '../src/app.js';

const server = http.createServer(app);

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(() => server.close());

function makeRequest(path: string, headers: Record<string, string> = {}): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        }
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res));
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify({}));
    req.end();
  });
}

describe('Rate Limiting', () => {
  it('allows up to 30 requests and then returns 429', async () => {
    // We'll use a unique token to avoid interference from other tests or previous runs
    const testToken = `test-token-${Date.now()}`;
    const headers = { 'x-plover-auth-token': testToken };

    // First 30 requests should NOT be 429 (they might be 401 or 400 because we send empty body, but not 429)
    for (let i = 0; i < 30; i++) {
      const res = await makeRequest('/api/decompose', headers);
      expect(res.statusCode, `Request ${i + 1} failed`).not.toBe(429);
    }

    // 31st request should be 429
    const res31 = await makeRequest('/api/decompose', headers);
    expect(res31.statusCode).toBe(429);
  }, 10000);

  it('keys differently for different tokens', async () => {
    const tokenA = `token-a-${Date.now()}`;
    const tokenB = `token-b-${Date.now()}`;

    // Exhaust token A
    for (let i = 0; i < 30; i++) {
      await makeRequest('/api/decompose', { 'x-plover-auth-token': tokenA });
    }
    const resA = await makeRequest('/api/decompose', { 'x-plover-auth-token': tokenA });
    expect(resA.statusCode).toBe(429);

    // Token B should still be allowed
    const resB = await makeRequest('/api/decompose', { 'x-plover-auth-token': tokenB });
    expect(resB.statusCode).not.toBe(429);
  }, 20000);
});

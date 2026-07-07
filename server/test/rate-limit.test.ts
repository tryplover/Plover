import { describe, it, expect, afterAll, beforeAll } from 'vitest';
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
  it('allows up to 30 requests from one IP and then returns 429', async () => {
    // Unique X-Forwarded-For per test so each test gets its own bucket
    // (trust proxy is enabled, so req.ip resolves to this value).
    const clientIp = '10.0.0.1';
    const headers = { 'X-Forwarded-For': clientIp };

    // First 30 requests should NOT be 429 (they might be 401 or 400 because we send empty body, but not 429)
    for (let i = 0; i < 30; i++) {
      const res = await makeRequest('/api/decompose', headers);
      expect(res.statusCode, `Request ${i + 1} failed`).not.toBe(429);
    }

    // 31st request should be 429
    const res31 = await makeRequest('/api/decompose', headers);
    expect(res31.statusCode).toBe(429);
  }, 10000);

  it('keys differently for different IPs', async () => {
    const ipA = '10.0.0.2';
    const ipB = '10.0.0.3';

    // Exhaust IP A
    for (let i = 0; i < 30; i++) {
      await makeRequest('/api/decompose', { 'X-Forwarded-For': ipA });
    }
    const resA = await makeRequest('/api/decompose', { 'X-Forwarded-For': ipA });
    expect(resA.statusCode).toBe(429);

    // IP B should still be allowed
    const resB = await makeRequest('/api/decompose', { 'X-Forwarded-For': ipB });
    expect(resB.statusCode).not.toBe(429);
  }, 20000);
});

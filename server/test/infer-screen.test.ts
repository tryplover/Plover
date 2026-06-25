import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import http from 'node:http';

const generateContent = vi.fn();
const getGenerativeModel = vi.fn().mockReturnValue({ generateContent });

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return { getGenerativeModel };
  }),
  FunctionCallingMode: { ANY: 'ANY' },
  SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' },
}));

process.env.GEMINI_API_KEY = 'test-key';
const { default: app } = await import('../src/app.js');

function post(server: http.Server, path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const payload = JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: data }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
afterAll(() => server.close());

describe('POST /api/infer-screen', () => {
  beforeEach(() => {
    generateContent.mockReset();
    getGenerativeModel.mockReturnValue({ generateContent });
  });

  it('rejects missing screenshot', async () => {
    const res = await post(server, '/api/infer-screen', {});
    expect(res.status).toBe(400);
  });

  it('returns structured Vision output on success', async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        functionCalls: () => [{ name: 'inferScreen', args: { summary: 'User is in Slack', activeApp: 'Slack', currentTask: 'Replying to a thread', confidence: 0.7 } }],
      },
    });
    const res = await post(server, '/api/infer-screen', {
      screenshotBase64: Buffer.from([0x89, 0x50]).toString('base64'),
      windowContext: { app: 'Slack', title: '#eng' },
    });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({ summary: 'User is in Slack', activeApp: 'Slack', confidence: 0.7 });
  });
});

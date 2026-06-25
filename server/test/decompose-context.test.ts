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
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: data }); }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
afterAll(() => server.close());

describe('POST /api/decompose with recentActivity', () => {
  beforeEach(() => {
    generateContent.mockReset();
    getGenerativeModel.mockReturnValue({ generateContent });
  });

  it('rejects more than 200 activity entries', async () => {
    const res = await post(server, '/api/decompose', {
      goalText: 'x',
      now: '2026-06-25T00:00:00.000Z',
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: Array.from({ length: 201 }, () => ({
        kind: 'k',
        payload: {},
        ts: '2026-06-25T00:00:00.000Z',
      })),
    });
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.error).toMatch(/200/);
  });

  it('rejects recentActivity that is not an array', async () => {
    const res = await post(server, '/api/decompose', {
      goalText: 'x',
      now: '2026-06-25T00:00:00.000Z',
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: 'not-an-array',
    });
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    expect(body.error).toMatch(/array/i);
  });

  it('includes the activity block in the prompt when provided', async () => {
    let capturedPrompt = '';
    generateContent.mockImplementationOnce(async (req: { contents: Array<{ parts: Array<{ text: string }> }> }) => {
      capturedPrompt = req.contents[0]?.parts[0]?.text ?? '';
      return {
        response: {
          functionCalls: () => [
            {
              name: 'decomposeGoal',
              args: {
                goal: { title: 'Finish doc', description: 'Write the doc' },
                subtasks: [{ title: 'Outline', estimate_minutes: 30 }],
              },
            },
          ],
        },
      };
    });

    const res = await post(server, '/api/decompose', {
      goalText: 'Finish doc',
      now: '2026-06-25T00:00:00.000Z',
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: [{ kind: 'gdocs_revision', payload: { name: 'Q3 Roadmap' }, ts: '2026-06-25T11:00:00.000Z' }],
    });

    expect(res.status).toBe(200);
    expect(capturedPrompt).toMatch(/gdocs_revision/);
    expect(capturedPrompt).toMatch(/recent computer activity/);
  });

  it('omits the activity block when recentActivity is absent', async () => {
    let capturedPrompt = '';
    generateContent.mockImplementationOnce(async (req: { contents: Array<{ parts: Array<{ text: string }> }> }) => {
      capturedPrompt = req.contents[0]?.parts[0]?.text ?? '';
      return {
        response: {
          functionCalls: () => [
            {
              name: 'decomposeGoal',
              args: {
                goal: { title: 'Plain goal', description: 'Just a goal' },
                subtasks: [{ title: 'Step', estimate_minutes: 30 }],
              },
            },
          ],
        },
      };
    });

    const res = await post(server, '/api/decompose', {
      goalText: 'Plain goal',
      now: '2026-06-25T00:00:00.000Z',
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(res.status).toBe(200);
    expect(capturedPrompt).not.toMatch(/recent computer activity/);
  });
});

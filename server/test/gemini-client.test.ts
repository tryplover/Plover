import { describe, it, expect, vi } from 'vitest';
import { KeyPool } from '../src/gemini-keys.js';
import { generateContentWithKeyRotation, isQuotaError } from '../src/gemini-client.js';

function makeMockClient(handler: (apiKey: string) => Promise<unknown>) {
  return (apiKey: string) => ({
    getGenerativeModel: () => ({
      generateContent: () => handler(apiKey) as Promise<never>,
    }),
  });
}

describe('isQuotaError', () => {
  it('detects status 429', () => {
    expect(isQuotaError({ status: 429, message: 'too many' })).toBe(true);
  });
  it('detects "quota" in message', () => {
    expect(isQuotaError(new Error('Quota exceeded for model'))).toBe(true);
  });
  it('detects "rate limit"', () => {
    expect(isQuotaError(new Error('Rate limit reached'))).toBe(true);
  });
  it('detects RESOURCE_EXHAUSTED', () => {
    expect(isQuotaError(new Error('RESOURCE_EXHAUSTED for tier'))).toBe(true);
  });
  it('rejects a plain 500 error', () => {
    expect(isQuotaError({ status: 500, message: 'internal' })).toBe(false);
  });
  it('rejects null/undefined', () => {
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('generateContentWithKeyRotation', () => {
  it('returns the response from the first key when it succeeds', async () => {
    const pool = new KeyPool(['a', 'b'], { cooldownMs: 60_000, initialIndex: 0 });
    const handler = vi.fn(async () => ({ response: { text: () => 'ok' } }));
    const res = await generateContentWithKeyRotation(
      pool,
      { contents: [] },
      { modelName: 'test', nowMs: () => 0, createClient: makeMockClient(handler) },
    );
    expect((res as { response: { text: () => string } }).response.text()).toBe('ok');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('a');
  });

  it('rotates to next key on 429 and returns the second key\'s response', async () => {
    const pool = new KeyPool(['a', 'b'], { cooldownMs: 60_000, initialIndex: 0 });
    const handler = vi.fn(async (key: string) => {
      if (key === 'a') throw Object.assign(new Error('quota exceeded'), { status: 429 });
      return { response: { text: () => 'from-b' } };
    });
    const res = await generateContentWithKeyRotation(
      pool,
      { contents: [] },
      { modelName: 'test', nowMs: () => 0, createClient: makeMockClient(handler) },
    );
    expect((res as { response: { text: () => string } }).response.text()).toBe('from-b');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(pool.getCurrent(0)).toBe('b');
    expect(pool.getCurrent(59_999)).toBe('b');
  });

  it('does NOT rotate on non-quota errors — throws immediately', async () => {
    const pool = new KeyPool(['a', 'b'], { cooldownMs: 60_000, initialIndex: 0 });
    const handler = vi.fn(async () => { throw new Error('internal server error'); });
    await expect(
      generateContentWithKeyRotation(
        pool,
        { contents: [] },
        { modelName: 'test', nowMs: () => 0, createClient: makeMockClient(handler) },
      ),
    ).rejects.toThrow('internal server error');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws the cooling-down sentinel with the last quota error as cause when all keys are exhausted this call', async () => {
    const pool = new KeyPool(['a', 'b'], { cooldownMs: 60_000, initialIndex: 0 });
    const handler = vi.fn(async () => { throw Object.assign(new Error('quota'), { status: 429 }); });
    let caught: unknown;
    await generateContentWithKeyRotation(
      pool,
      { contents: [] },
      { modelName: 'test', nowMs: () => 0, createClient: makeMockClient(handler) },
    ).catch((e) => { caught = e; });
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('All Gemini API keys are cooling down');
    expect((caught as Error & { cause?: Error }).cause?.message).toBe('quota');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(pool.getCurrent(0)).toBeNull();
  });

  it('throws immediately when the pool is fully cooling down before the call starts', async () => {
    const pool = new KeyPool(['a'], { cooldownMs: 60_000, initialIndex: 0 });
    pool.markExhausted('a', 0);
    const handler = vi.fn();
    await expect(
      generateContentWithKeyRotation(
        pool,
        { contents: [] },
        { modelName: 'test', nowMs: () => 0, createClient: makeMockClient(handler) },
      ),
    ).rejects.toThrow('All Gemini API keys are cooling down');
    expect(handler).not.toHaveBeenCalled();
  });
});

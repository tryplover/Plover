import { describe, it, expect } from 'vitest';
import { KeyPool } from '../src/gemini-keys.js';

describe('KeyPool', () => {
  it('rejects an empty key list', () => {
    expect(() => new KeyPool([])).toThrow('KeyPool requires at least one key');
  });

  it('single-key mode returns the same key every call', () => {
    const pool = new KeyPool(['solo-key'], { cooldownMs: 60_000, initialIndex: 0 });
    expect(pool.size).toBe(1);
    expect(pool.getCurrent(0)).toBe('solo-key');
    expect(pool.getCurrent(1000)).toBe('solo-key');
  });

  it('single-key mode returns null after markExhausted, then recovers after cooldown', () => {
    const pool = new KeyPool(['solo-key'], { cooldownMs: 60_000, initialIndex: 0 });
    pool.markExhausted('solo-key', 0);
    expect(pool.getCurrent(0)).toBeNull();
    expect(pool.getCurrent(59_999)).toBeNull();
    expect(pool.getCurrent(60_000)).toBe('solo-key');
  });

  it('multi-key mode advances to the next key when the current is exhausted', () => {
    const pool = new KeyPool(['a', 'b', 'c'], { cooldownMs: 60_000, initialIndex: 0 });
    expect(pool.getCurrent(0)).toBe('a');
    pool.markExhausted('a', 0);
    expect(pool.getCurrent(0)).toBe('b');
    pool.markExhausted('b', 0);
    expect(pool.getCurrent(0)).toBe('c');
  });

  it('returns null when every key is cooling down, and recovers when the earliest cooldown expires', () => {
    const pool = new KeyPool(['a', 'b'], { cooldownMs: 60_000, initialIndex: 0 });
    pool.markExhausted('a', 0);
    pool.markExhausted('b', 30_000);
    expect(pool.getCurrent(30_000)).toBeNull();
    expect(pool.getCurrent(60_000)).toBe('a');
    expect(pool.getCurrent(90_000)).toBe('b');
  });

  it('deduplicates keys and preserves first-seen order', () => {
    const pool = new KeyPool(['a', 'b', 'a', 'c'], { cooldownMs: 60_000, initialIndex: 0 });
    expect(pool.size).toBe(3);
    expect(pool.getCurrent(0)).toBe('a');
    pool.markExhausted('a', 0);
    expect(pool.getCurrent(0)).toBe('b');
    pool.markExhausted('b', 0);
    expect(pool.getCurrent(0)).toBe('c');
  });

  it('fromEnv prefers GEMINI_API_KEYS over GEMINI_API_KEY', () => {
    const pool = KeyPool.fromEnv(
      { GEMINI_API_KEYS: 'a, b ,c,', GEMINI_API_KEY: 'ignored' } as NodeJS.ProcessEnv,
      { cooldownMs: 60_000, initialIndex: 0 },
    );
    expect(pool).not.toBeNull();
    expect(pool!.size).toBe(3);
    expect(pool!.getCurrent(0)).toBe('a');
  });

  it('fromEnv falls back to GEMINI_API_KEY when GEMINI_API_KEYS is empty', () => {
    const pool = KeyPool.fromEnv(
      { GEMINI_API_KEYS: '', GEMINI_API_KEY: 'solo' } as NodeJS.ProcessEnv,
      { cooldownMs: 60_000, initialIndex: 0 },
    );
    expect(pool).not.toBeNull();
    expect(pool!.size).toBe(1);
    expect(pool!.getCurrent(0)).toBe('solo');
  });

  it('fromEnv returns null when neither var is set', () => {
    const pool = KeyPool.fromEnv({} as NodeJS.ProcessEnv);
    expect(pool).toBeNull();
  });

  it('fingerprint returns first-4…last-4', () => {
    const pool = new KeyPool(['abcdefghijklmnop'], { initialIndex: 0 });
    expect(pool.fingerprint('abcdefghijklmnop')).toBe('abcd…mnop');
  });
});

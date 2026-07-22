import { describe, it, expect, afterEach } from 'vitest';
import { resolveViteOrEnv } from '@main/config/env.js';

describe('resolveViteOrEnv', () => {
  const originalEnv = process.env.SOME_TEST_VAR;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SOME_TEST_VAR;
    else process.env.SOME_TEST_VAR = originalEnv;
  });

  it('returns process.env value when set (dev, no Vite bake)', () => {
    process.env.SOME_TEST_VAR = 'from-env';
    expect(resolveViteOrEnv('SOME_TEST_VAR', { devFallback: 'fallback' })).toBe('from-env');
  });

  it('returns devFallback when unset in dev', () => {
    delete process.env.SOME_TEST_VAR;
    expect(resolveViteOrEnv('SOME_TEST_VAR', { devFallback: 'fallback' })).toBe('fallback');
  });
});

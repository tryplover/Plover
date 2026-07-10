import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStartSignup } = vi.hoisted(() => {
  return { mockStartSignup: vi.fn() };
});

vi.mock('../../../src/main/auth/signup-flow.js', () => ({
  startSignup: mockStartSignup,
}));

import { UnauthorizedError } from '../../../src/main/http/authed-fetch';
import { withAuthRetry } from '../../../src/main/auth/with-auth-retry';

describe('withAuthRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSignup.mockResolvedValue(undefined);
  });

  it('returns fn result when fn succeeds first time', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withAuthRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockStartSignup).not.toHaveBeenCalled();
  });

  it('retries once after UnauthorizedError and returns the retry result', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new UnauthorizedError('401'))
      .mockResolvedValueOnce('after-signup');
    const result = await withAuthRetry(fn);
    expect(result).toBe('after-signup');
    expect(mockStartSignup).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-Unauthorized errors without invoking signup', async () => {
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withAuthRetry(fn)).rejects.toThrow('boom');
    expect(mockStartSignup).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('propagates the retry failure if fn still fails after signup', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new UnauthorizedError('401'))
      .mockRejectedValueOnce(new UnauthorizedError('still-401'));
    await expect(withAuthRetry(fn)).rejects.toThrow('still-401');
    expect(mockStartSignup).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

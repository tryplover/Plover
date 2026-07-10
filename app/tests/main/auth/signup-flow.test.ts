import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShell, mockSetPloverToken } = vi.hoisted(() => {
  return {
    mockShell: {
      openExternal: vi.fn(),
    },
    mockSetPloverToken: vi.fn(),
  };
});

vi.mock('electron', () => ({
  shell: mockShell,
}));

vi.mock('../../../src/main/auth/plover-token.js', () => ({
  setPloverToken: mockSetPloverToken,
}));

import {
  _clearPendingForTests,
  completeSignup,
  startSignup,
} from '../../../src/main/auth/signup-flow';

function extractStateFromOpenExternal(): string {
  expect(mockShell.openExternal).toHaveBeenCalledTimes(1);
  const url = mockShell.openExternal.mock.calls[0]?.[0] as string;
  expect(url).toMatch(/^https?:\/\/.+\/signup\?state=[A-Za-z0-9_-]+$/);
  const parsed = new URL(url);
  const state = parsed.searchParams.get('state');
  expect(state).toBeTruthy();
  return state!;
}

describe('signup-flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShell.openExternal.mockResolvedValue(true);
    mockSetPloverToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    _clearPendingForTests();
    vi.useRealTimers();
  });

  it('opens external URL matching /signup?state=<nonce>', async () => {
    const promise = startSignup();
    promise.catch(() => {}); // avoid unhandled rejection warnings
    extractStateFromOpenExternal();
    _clearPendingForTests();
    await expect(promise).rejects.toThrow(/Cleared for tests/);
  });

  it('resolves and stores token on matching state', async () => {
    const promise = startSignup();
    const state = extractStateFromOpenExternal();

    completeSignup(`plover://auth?token=xyz&state=${state}`);

    await expect(promise).resolves.toBeUndefined();
    expect(mockSetPloverToken).toHaveBeenCalledWith('xyz');
  });

  it('does nothing when state does not match', async () => {
    const promise = startSignup();
    extractStateFromOpenExternal();

    completeSignup('plover://auth?token=xyz&state=WRONG');

    const winner = await Promise.race([
      promise.then(() => 'resolved').catch(() => 'rejected'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 200)),
    ]);
    expect(winner).toBe('pending');
    expect(mockSetPloverToken).not.toHaveBeenCalled();
  });

  it('does nothing when token is missing', async () => {
    const promise = startSignup();
    const state = extractStateFromOpenExternal();

    completeSignup(`plover://auth?state=${state}`);

    const winner = await Promise.race([
      promise.then(() => 'resolved').catch(() => 'rejected'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 200)),
    ]);
    expect(winner).toBe('pending');
    expect(mockSetPloverToken).not.toHaveBeenCalled();
  });

  it('rejects after 10-minute timeout', async () => {
    vi.useFakeTimers();
    const promise = startSignup();
    promise.catch(() => {});
    extractStateFromOpenExternal();

    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

    await expect(promise).rejects.toThrow(/timed out/i);
    expect(mockSetPloverToken).not.toHaveBeenCalled();
  });

  it('supersedes an existing pending signup when startSignup is called again', async () => {
    const first = startSignup();
    first.catch(() => {});
    const firstState = extractStateFromOpenExternal();

    mockShell.openExternal.mockClear();

    const second = startSignup();
    expect(mockShell.openExternal).toHaveBeenCalledTimes(1);
    const secondUrl = mockShell.openExternal.mock.calls[0]?.[0] as string;
    const secondState = new URL(secondUrl).searchParams.get('state');
    expect(secondState).toBeTruthy();
    expect(secondState).not.toBe(firstState);

    await expect(first).rejects.toThrow(/superseded/i);

    completeSignup(`plover://auth?token=abc&state=${secondState}`);
    await expect(second).resolves.toBeUndefined();
    expect(mockSetPloverToken).toHaveBeenCalledWith('abc');
  });

  it('rejects when setPloverToken fails', async () => {
    mockSetPloverToken.mockRejectedValueOnce(new Error('keychain unavailable'));

    const promise = startSignup();
    const state = extractStateFromOpenExternal();

    completeSignup(`plover://auth?token=xyz&state=${state}`);

    await expect(promise).rejects.toThrow(/keychain unavailable/);
  });

  it('ignores malformed URLs', async () => {
    const promise = startSignup();
    promise.catch(() => {});
    extractStateFromOpenExternal();

    completeSignup('not a url');
    completeSignup('https://example.com/nope');

    const winner = await Promise.race([
      promise.then(() => 'resolved').catch(() => 'rejected'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 100)),
    ]);
    expect(winner).toBe('pending');
    expect(mockSetPloverToken).not.toHaveBeenCalled();
  });
});

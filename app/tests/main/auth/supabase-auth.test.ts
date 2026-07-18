import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShell, mockSupabaseAuth, mockGetSupabaseClient } = vi.hoisted(() => {
  return {
    mockShell: {
      openExternal: vi.fn(),
    },
    mockSupabaseAuth: {
      signInWithOAuth: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      startAutoRefresh: vi.fn(),
    },
    mockGetSupabaseClient: vi.fn(),
  };
});

vi.mock('electron', () => ({
  shell: mockShell,
}));

vi.mock('../../../src/main/auth/supabase-client.js', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

import {
  getCurrentUser,
  restoreSession,
  signIn,
  signOut,
  startAutoRefresh,
  SupabaseAuthenticationError,
} from '../../../src/main/auth/supabase-auth';

async function triggerRedirect(query: string): Promise<void> {
  // Wait a tick so the loopback server in signIn() has finished server.listen().
  await new Promise((resolve) => setTimeout(resolve, 20));
  const redirectUri = mockSupabaseAuth.signInWithOAuth.mock.calls[0]?.[0]?.options
    ?.redirectTo as string;
  await fetch(`${redirectUri}${query}`);
}

describe('supabase-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseClient.mockReturnValue({ auth: mockSupabaseAuth });
    mockShell.openExternal.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('signIn', () => {
    it('opens the OAuth URL and resolves after exchangeCodeForSession succeeds', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://example.supabase.co/authorize' },
        error: null,
      });
      mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({ error: null });

      const promise = signIn();
      await triggerRedirect('/?code=abc123');

      await expect(promise).resolves.toBeUndefined();
      expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.supabase.co/authorize');
      expect(mockSupabaseAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    });

    it('rejects when the OAuth redirect carries an error param', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://example.supabase.co/authorize' },
        error: null,
      });

      const promise = signIn();
      promise.catch(() => {
        // avoid unhandled rejection warning; assertion happens below
      });
      await triggerRedirect('/?error=access_denied');

      await expect(promise).rejects.toThrow(SupabaseAuthenticationError);
      await expect(promise).rejects.toThrow(/access_denied/);
    });

    it('rejects when exchangeCodeForSession returns an error', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://example.supabase.co/authorize' },
        error: null,
      });
      mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({
        error: { message: 'invalid grant' },
      });

      const promise = signIn();
      promise.catch((err: unknown) => {
        console.log('[test] promise caught:', err);
      });
      await triggerRedirect('/?code=bad-code');

      await expect(promise).rejects.toThrow('invalid grant');
    });

    it('rejects when signInWithOAuth itself fails to produce a URL', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'provider not configured' },
      });

      await expect(signIn()).rejects.toThrow('provider not configured');
      expect(mockShell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('maps data.user to {id, email}', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'jordan@example.com' } },
      });

      await expect(getCurrentUser()).resolves.toEqual({
        id: 'user-1',
        email: 'jordan@example.com',
      });
    });

    it('returns null when there is no user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null } });

      await expect(getCurrentUser()).resolves.toBeNull();
    });

    it('maps a missing email to null', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-2', email: null } },
      });

      await expect(getCurrentUser()).resolves.toEqual({ id: 'user-2', email: null });
    });
  });

  describe('signOut', () => {
    it('calls auth.signOut()', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockSupabaseAuth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoreSession', () => {
    it('returns true when a session exists', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } } });
      await expect(restoreSession()).resolves.toBe(true);
    });

    it('returns false when there is no session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
      await expect(restoreSession()).resolves.toBe(false);
    });
  });

  describe('startAutoRefresh', () => {
    it('delegates to auth.startAutoRefresh()', () => {
      startAutoRefresh();
      expect(mockSupabaseAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

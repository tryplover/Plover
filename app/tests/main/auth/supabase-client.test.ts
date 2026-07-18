import { describe, expect, it, beforeEach, vi } from 'vitest';

const { mockKeytar, mockCreateClient } = vi.hoisted(() => {
  return {
    mockKeytar: {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn(),
    },
    mockCreateClient: vi.fn(),
  };
});

vi.mock('keytar', () => ({
  default: mockKeytar,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { getSupabaseClient, _resetClientForTests } from '../../../src/main/auth/supabase-client';

describe('supabase-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetClientForTests();
    mockCreateClient.mockImplementation(() => ({ auth: {} }));
  });

  it('creates a singleton client backed by keytar storage', () => {
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).toBe(second);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('resets and recreates the client after _resetClientForTests', () => {
    const first = getSupabaseClient();
    _resetClientForTests();
    const second = getSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });

  it('configures the storage adapter to route through the plover/supabase-session keytar entry', async () => {
    getSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as {
      auth: { storage: { getItem: () => Promise<string | null> } };
    };
    const storage = options.auth.storage;

    mockKeytar.getPassword.mockResolvedValueOnce('stored-session');
    await expect(storage.getItem()).resolves.toBe('stored-session');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('plover', 'supabase-session');
  });

  it('storage.setItem writes to the plover/supabase-session keytar entry', async () => {
    getSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as {
      auth: { storage: { setItem: (key: string, value: string) => Promise<void> } };
    };
    const storage = options.auth.storage;

    mockKeytar.setPassword.mockResolvedValueOnce(undefined);
    await storage.setItem('unused-key', 'new-session');
    expect(mockKeytar.setPassword).toHaveBeenCalledWith(
      'plover',
      'supabase-session',
      'new-session',
    );
  });

  it('storage.removeItem deletes the plover/supabase-session keytar entry', async () => {
    getSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as {
      auth: { storage: { removeItem: () => Promise<void> } };
    };
    const storage = options.auth.storage;

    mockKeytar.deletePassword.mockResolvedValueOnce(true);
    await storage.removeItem();
    expect(mockKeytar.deletePassword).toHaveBeenCalledWith('plover', 'supabase-session');
  });
});

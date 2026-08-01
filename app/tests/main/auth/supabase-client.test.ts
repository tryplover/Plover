import { describe, expect, it, beforeEach, vi } from 'vitest';
import { join } from 'node:path';

const EXPECTED_SESSION_PATH = join('/fake/userData', 'supabase-session.enc');

const { mockSafeStorage, mockGetPath, mockCreateClient, mockReadFile, mockWriteFile, mockUnlink } =
  vi.hoisted(() => {
    return {
      mockSafeStorage: {
        isEncryptionAvailable: vi.fn(),
        encryptString: vi.fn(),
        decryptString: vi.fn(),
      },
      mockGetPath: vi.fn(),
      mockCreateClient: vi.fn(),
      mockReadFile: vi.fn(),
      mockWriteFile: vi.fn(),
      mockUnlink: vi.fn(),
    };
  });

vi.mock('electron', () => ({
  app: { getPath: mockGetPath },
  safeStorage: mockSafeStorage,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { getSupabaseClient, _resetClientForTests } from '../../../src/main/auth/supabase-client';

describe('supabase-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetClientForTests();
    mockGetPath.mockReturnValue('/fake/userData');
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockCreateClient.mockImplementation(() => ({ auth: {} }));
  });

  it('creates a singleton client backed by encrypted file storage', () => {
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

  function getStorage(): {
    getItem: () => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: () => Promise<void>;
  } {
    getSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as {
      auth: {
        storage: {
          getItem: () => Promise<string | null>;
          setItem: (key: string, value: string) => Promise<void>;
          removeItem: () => Promise<void>;
        };
      };
    };
    return options.auth.storage;
  }

  it('storage.getItem reads and decrypts the session file', async () => {
    const storage = getStorage();
    const encryptedBuffer = Buffer.from('encrypted-bytes');
    mockReadFile.mockResolvedValueOnce(encryptedBuffer);
    mockSafeStorage.decryptString.mockReturnValueOnce('stored-session');

    await expect(storage.getItem()).resolves.toBe('stored-session');
    expect(mockReadFile).toHaveBeenCalledWith(EXPECTED_SESSION_PATH);
    expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encryptedBuffer);
  });

  it('storage.getItem resolves null when the session file does not exist', async () => {
    const storage = getStorage();
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValueOnce(enoent);

    await expect(storage.getItem()).resolves.toBeNull();
    expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });

  it('storage.setItem encrypts and writes the session file', async () => {
    const storage = getStorage();
    const encryptedBuffer = Buffer.from('encrypted-bytes');
    mockSafeStorage.encryptString.mockReturnValueOnce(encryptedBuffer);
    mockWriteFile.mockResolvedValueOnce(undefined);

    await storage.setItem('unused-key', 'new-session');

    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('new-session');
    expect(mockWriteFile).toHaveBeenCalledWith(EXPECTED_SESSION_PATH, encryptedBuffer);
  });

  it('storage.removeItem deletes the session file', async () => {
    const storage = getStorage();
    mockUnlink.mockResolvedValueOnce(undefined);

    await storage.removeItem();

    expect(mockUnlink).toHaveBeenCalledWith(EXPECTED_SESSION_PATH);
  });

  it('storage.removeItem treats a missing session file as success', async () => {
    const storage = getStorage();
    const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockUnlink.mockRejectedValueOnce(enoent);

    await expect(storage.removeItem()).resolves.toBeUndefined();
  });

  it('storage.setItem throws when encryption is unavailable', async () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    const storage = getStorage();

    await expect(storage.setItem('unused-key', 'new-session')).rejects.toThrow(
      /safeStorage encryption is not available/,
    );
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('storage.getItem throws when encryption is unavailable', async () => {
    const storage = getStorage();
    mockReadFile.mockResolvedValueOnce(Buffer.from('encrypted-bytes'));
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

    await expect(storage.getItem()).rejects.toThrow(/safeStorage encryption is not available/);
    expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });
});

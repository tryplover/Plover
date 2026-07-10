import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getPloverToken,
  setPloverToken,
  clearPloverToken,
} from '../../../src/main/auth/plover-token';

const { mockKeytar } = vi.hoisted(() => {
  return {
    mockKeytar: {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn(),
    },
  };
});

vi.mock('keytar', () => ({
  default: mockKeytar,
}));

describe('plover-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPloverToken', () => {
    it('returns null when keytar returns null', async () => {
      mockKeytar.getPassword.mockResolvedValueOnce(null);
      const result = await getPloverToken();
      expect(result).toBeNull();
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('plover', 'plover_token');
    });

    it('returns the stored token', async () => {
      mockKeytar.getPassword.mockResolvedValueOnce('stored-plover-token');
      const result = await getPloverToken();
      expect(result).toBe('stored-plover-token');
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('plover', 'plover_token');
    });

    it('propagates keytar errors', async () => {
      const err = new Error('keychain unavailable');
      mockKeytar.getPassword.mockRejectedValueOnce(err);
      await expect(getPloverToken()).rejects.toThrow('keychain unavailable');
    });
  });

  describe('setPloverToken', () => {
    it('calls keytar.setPassword with correct service, account, and token', async () => {
      mockKeytar.setPassword.mockResolvedValueOnce(undefined);
      await setPloverToken('new-token-value');
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'plover',
        'plover_token',
        'new-token-value',
      );
    });
  });

  describe('clearPloverToken', () => {
    it('calls keytar.deletePassword and resolves when it returns true', async () => {
      mockKeytar.deletePassword.mockResolvedValueOnce(true);
      await expect(clearPloverToken()).resolves.toBeUndefined();
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('plover', 'plover_token');
    });

    it('resolves without error when deletePassword returns false', async () => {
      mockKeytar.deletePassword.mockResolvedValueOnce(false);
      await expect(clearPloverToken()).resolves.toBeUndefined();
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith('plover', 'plover_token');
    });
  });
});

import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import { app, safeStorage } from 'electron';
import { join } from 'node:path';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { readViteEnv } from '../config/vite-env.js';

const SESSION_FILE_NAME = 'supabase-session.enc';

function sessionFilePath(): string {
  return join(app.getPath('userData'), SESSION_FILE_NAME);
}

function requireEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'safeStorage encryption is not available on this system; refusing to persist the Supabase session',
    );
  }
}

// Supabase computes a storage key internally, but this app only ever caches
// one session per machine, so every key routes through the same fixed file
// on disk. This used to be a single keytar (service, account) pair, but
// Windows Credential Manager caps each entry at ~2.5KB and a full Supabase
// session (JWT access token + refresh token + user object) routinely
// exceeds that, so it's now an encrypted file with no such size limit.
class EncryptedFileStorage implements SupportedStorage {
  async getItem(): Promise<string | null> {
    let buffer: Buffer;
    try {
      buffer = await readFile(sessionFilePath());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
    requireEncryptionAvailable();
    return safeStorage.decryptString(buffer);
  }
  async setItem(_key: string, value: string): Promise<void> {
    requireEncryptionAvailable();
    const encrypted = safeStorage.encryptString(value);
    await writeFile(sessionFilePath(), encrypted);
  }
  async removeItem(): Promise<void> {
    try {
      await unlink(sessionFilePath());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }
}

function resolveEnv(key: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  const fromVite = readViteEnv(key);
  if (fromVite) return fromVite;
  return process.env[key] ?? '';
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(resolveEnv('SUPABASE_URL'), resolveEnv('SUPABASE_ANON_KEY'), {
      auth: {
        storage: new EncryptedFileStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function _resetClientForTests(): void {
  client = null;
}

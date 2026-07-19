import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import keytar from 'keytar';

const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'supabase-session';

// Supabase computes a storage key internally, but this app only ever caches
// one session per machine, so every key routes through the same fixed
// keytar (service, account) pair.
class KeytarStorage implements SupportedStorage {
  async getItem(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
  async setItem(_key: string, value: string): Promise<void> {
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, value);
  }
  async removeItem(): Promise<void> {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
}

function resolveEnv(key: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  try {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[
      key
    ];
    if (fromVite) return fromVite;
  } catch {
    // import.meta.env not defined outside the Vite-built bundle (tests, etc.)
  }
  return process.env[key] ?? '';
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(resolveEnv('SUPABASE_URL'), resolveEnv('SUPABASE_ANON_KEY'), {
      auth: {
        storage: new KeytarStorage(),
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

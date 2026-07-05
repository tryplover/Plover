import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import keytar from 'keytar';

const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'supabase-session';

// Supabase computes a storage key internally (e.g. `sb-<project-ref>-auth-token`), but this
// app only ever caches one session per machine, so every key routes through the same
// fixed keytar (service, account) pair and the `key` argument is intentionally unused.
/* eslint-disable @typescript-eslint/no-unused-vars */
class KeytarStorage implements SupportedStorage {
  async getItem(key: string): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  async setItem(key: string, value: string): Promise<void> {
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, value);
  }

  async removeItem(key: string): Promise<void> {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '', {
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

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browser } from "wxt/browser";

export const storageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const stored = await browser.storage.local.get(key);
    const value = stored[key];
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  client ??= createClient(
    import.meta.env.WXT_SUPABASE_URL as string,
    import.meta.env.WXT_SUPABASE_ANON_KEY as string,
    {
      auth: {
        storage: storageAdapter,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    },
  );
  return client;
}

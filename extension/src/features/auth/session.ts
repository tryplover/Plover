import { browser } from "wxt/browser";
import type { Command } from "@/shared/messages";
import { getLocal } from "@/shared/storage";
import { getSupabase } from "@/features/auth/supabase";

export const GATED_COMMANDS: Command["type"][] = [
  "timer/start",
  "focus/set",
  "blocking/set",
  "task/decompose",
  "task/save",
  "calendar/connect",
];

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function isGated(cmd: Command): boolean {
  if (!GATED_COMMANDS.includes(cmd.type)) return false;
  if (cmd.type === "focus/set" || cmd.type === "blocking/set") return cmd.on;
  return true;
}

const SESSION_KEY = /^sb-.+-auth-token$/;

export async function sessionKeys(): Promise<string[]> {
  const all = await browser.storage.local.get(null);
  return Object.keys(all).filter((k) => SESSION_KEY.test(k));
}

export async function isSignedIn(): Promise<boolean> {
  if (await getLocal("needsSignIn")) return false;
  const all = await browser.storage.local.get(null);
  return Object.entries(all).some(([k, v]) => SESSION_KEY.test(k) && !!v);
}

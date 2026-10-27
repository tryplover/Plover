import type { Command } from "@/lib/messages";
import { getSupabase } from "./supabase";

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

export async function isSignedIn(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

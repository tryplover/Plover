import { browser } from "wxt/browser";
import type { Task } from "./types";

export type Command =
  | { type: "timer/start"; endBy?: number }
  | { type: "timer/pause" }
  | { type: "timer/resume" }
  | { type: "timer/skip" }
  | { type: "timer/stop" }
  | { type: "checkin/answer"; stepId: string | null }
  | { type: "task/decompose"; text: string }
  | { type: "task/save"; task: Task }
  | { type: "task/setActive"; taskId: string | null }
  | { type: "step/toggle"; taskId: string; stepId: string }
  | { type: "auth/google" }
  | {
      type: "auth/password";
      mode: "signIn" | "signUp";
      email: string;
      password: string;
    }
  | { type: "auth/signOut" }
  | { type: "focus/set"; on: boolean; endBy?: number }
  | { type: "blocking/set"; on: boolean }
  | { type: "calendar/connect" }
  | { type: "calendar/disconnect" };

export type CommandResult =
  { ok: true; data?: unknown } | { ok: false; error: string };

export async function sendCommand(cmd: Command): Promise<CommandResult> {
  try {
    const result = (await browser.runtime.sendMessage(cmd)) as
      CommandResult | undefined;
    return result ?? { ok: false, error: "No response from background" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

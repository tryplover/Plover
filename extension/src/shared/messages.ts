import { browser } from "wxt/browser";
import type { Task } from "@/shared/types";

export type Command =
  | { type: "timer/start"; endBy?: number; justFive?: boolean }
  | { type: "timer/pause" }
  | { type: "timer/resume" }
  | { type: "timer/skip" }
  | { type: "timer/stop" }
  | { type: "timer/keepGoing" }
  | { type: "timer/stopHere" }
  | { type: "checkin/answer"; stepId: string | null }
  | { type: "task/decompose"; text: string }
  | { type: "task/save"; task: Task }
  | { type: "task/setActive"; taskId: string | null }
  | { type: "step/toggle"; taskId: string; stepId: string }
  | { type: "task/park" }
  | {
      type: "task/resume";
      taskId: string;
      endBy?: number;
      justFive?: boolean;
    }
  | { type: "task/markDone"; taskId: string }
  | { type: "task/reopen"; taskId: string }
  | { type: "task/delete"; taskId: string }
  | { type: "task/clearDone" }
  | { type: "stats/clear" }
  | { type: "auth/google" }
  | {
      type: "auth/password";
      mode: "signIn" | "signUp";
      email: string;
      password: string;
    }
  | { type: "auth/signOut" }
  | { type: "auth/handoff"; tokenHash: string }
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

const COMMAND_TYPES: ReadonlySet<string> = new Set<Command["type"]>([
  "timer/start",
  "timer/pause",
  "timer/resume",
  "timer/skip",
  "timer/stop",
  "timer/keepGoing",
  "timer/stopHere",
  "checkin/answer",
  "task/decompose",
  "task/save",
  "task/setActive",
  "step/toggle",
  "task/park",
  "task/resume",
  "task/markDone",
  "task/reopen",
  "task/delete",
  "task/clearDone",
  "stats/clear",
  "auth/google",
  "auth/password",
  "auth/signOut",
  "auth/handoff",
  "focus/set",
  "blocking/set",
  "calendar/connect",
  "calendar/disconnect",
]);

export function isCommand(msg: unknown): msg is Command {
  return (
    typeof msg === "object" &&
    msg !== null &&
    typeof (msg as { type?: unknown }).type === "string" &&
    COMMAND_TYPES.has((msg as { type: string }).type)
  );
}

import type { Command, CommandResult } from "@/lib/messages";
import { isGated, isSignedIn } from "@/lib/auth/session";
import { setLocal } from "@/lib/storage";
import { enqueue } from "./queue";

export type Handler<T extends Command["type"]> = (
  cmd: Extract<Command, { type: T }>,
) => Promise<CommandResult>;

const handlers = new Map<string, Handler<Command["type"]>>();

export function registerHandler<T extends Command["type"]>(
  type: T,
  h: Handler<T>,
): void {
  handlers.set(type, h as unknown as Handler<Command["type"]>);
}

const UNQUEUED_COMMANDS: ReadonlySet<Command["type"]> = new Set([
  "auth/google",
  "task/decompose",
  "calendar/connect",
]);

export function dispatch(cmd: Command): Promise<CommandResult> {
  if (UNQUEUED_COMMANDS.has(cmd.type)) return run(cmd);
  return enqueue(() => run(cmd));
}

async function run(cmd: Command): Promise<CommandResult> {
  if (isGated(cmd) && !(await isSignedIn())) {
    await setLocal({ needsSignIn: true });
    return { ok: false, error: "not signed in" };
  }
  const handler = handlers.get(cmd.type);
  if (!handler) return { ok: false, error: `Unknown command: ${cmd.type}` };
  try {
    return await handler(cmd);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

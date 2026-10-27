import type { Command, CommandResult } from "@/lib/messages";
import { GATED_COMMANDS, isSignedIn } from "@/lib/auth/session";
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

export function dispatch(cmd: Command): Promise<CommandResult> {
  return enqueue(() => run(cmd));
}

async function run(cmd: Command): Promise<CommandResult> {
  if (GATED_COMMANDS.includes(cmd.type) && !(await isSignedIn())) {
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

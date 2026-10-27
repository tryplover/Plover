import { browser } from "wxt/browser";
import { enqueue } from "@/worker/queue";

const handlers = new Map<
  string,
  { fn: () => Promise<void>; queued: boolean }
>();

async function route(alarm: { name: string }): Promise<void> {
  const h = handlers.get(alarm.name);
  if (!h) return;
  await (h.queued ? enqueue(h.fn) : h.fn());
}

export function onAlarm(
  name: string,
  fn: () => Promise<void>,
  { queued = true }: { queued?: boolean } = {},
): void {
  handlers.set(name, { fn, queued });
  if (!browser.alarms.onAlarm.hasListener(route))
    browser.alarms.onAlarm.addListener(route);
}

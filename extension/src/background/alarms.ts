import { browser } from "wxt/browser";
import { enqueue } from "./queue";

const handlers = new Map<string, () => Promise<void>>();

async function route(alarm: { name: string }): Promise<void> {
  const fn = handlers.get(alarm.name);
  if (fn) await enqueue(fn);
}

export function onAlarm(name: string, fn: () => Promise<void>): void {
  handlers.set(name, fn);
  if (!browser.alarms.onAlarm.hasListener(route))
    browser.alarms.onAlarm.addListener(route);
}

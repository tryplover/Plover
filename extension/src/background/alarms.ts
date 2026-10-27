import { browser } from "wxt/browser";

const handlers = new Map<string, () => Promise<void>>();

async function route(alarm: { name: string }): Promise<void> {
  await handlers.get(alarm.name)?.();
}

export function onAlarm(name: string, fn: () => Promise<void>): void {
  handlers.set(name, fn);
  if (!browser.alarms.onAlarm.hasListener(route))
    browser.alarms.onAlarm.addListener(route);
}

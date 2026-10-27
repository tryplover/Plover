import { browser } from "wxt/browser";
import { getLocal } from "@/shared/storage";
import { remainingSeconds } from "@/features/timer/machine";
import type { TimerState } from "@/features/timer/types";
import { onAlarm } from "@/worker/alarms";

const BADGE_ALARM = "badge";

export async function updateBadge(
  timer: TimerState,
  nowMs: number,
): Promise<void> {
  if (timer.phase === "idle") {
    await browser.alarms.clear(BADGE_ALARM);
    await browser.action.setBadgeText({ text: "" });
    return;
  }
  await browser.action.setBadgeText({
    text: String(Math.ceil(remainingSeconds(timer, nowMs) / 60)),
  });
  if (timer.pausedAt === null) {
    await browser.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
  } else {
    await browser.alarms.clear(BADGE_ALARM);
  }
}

export function registerBadge(): void {
  onAlarm(BADGE_ALARM, async () =>
    updateBadge(await getLocal("timer"), Date.now()),
  );
}

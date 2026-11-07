import { browser } from "wxt/browser";
import { showNudge } from "@/features/buddy/worker";
import { findActiveTask, firstOpenStep } from "@/features/tasks/active-step";
import {
  getLocal,
  getSettings,
  isSettingsChange,
  setLocal,
} from "@/shared/storage";
import { onAlarm } from "@/worker/alarms";
import {
  CALENDAR_HEADSUP_ALARM,
  scheduleHeadsUp,
} from "@/features/calendar/worker";
import { setBlocking, reapplyBlocking } from "@/features/blocking/worker";
import { registerHandler } from "@/worker/controller";
import { enqueue } from "@/worker/queue";
import {
  onTimerEvent,
  resumeTimerNow,
  startTimerNow,
} from "@/features/timer/worker";

const NUDGE_ALARM = "focus-nudge";

async function scheduleFocusNudge(restart: boolean): Promise<void> {
  const { focusNudgeMinutes } = await getSettings();
  const alarm = await browser.alarms.get(NUDGE_ALARM);
  if (!restart && alarm?.periodInMinutes === focusNudgeMinutes) return;
  await browser.alarms.create(NUDGE_ALARM, {
    periodInMinutes: focusNudgeMinutes,
  });
}

async function setFocus(on: boolean, endBy?: number): Promise<void> {
  if (on) {
    const timer = await getLocal("timer");
    if (timer.phase === "idle") await startTimerNow(endBy);
    else if (timer.pausedAt !== null) await resumeTimerNow();
    await setBlocking(true);
    await setLocal({ focus: { on: true, startedAt: Date.now() } });
    await scheduleFocusNudge(true);
    await scheduleHeadsUp();
    return;
  }
  await browser.alarms.clear(NUDGE_ALARM);
  await browser.alarms.clear(CALENDAR_HEADSUP_ALARM);
  await setLocal({ focus: { on: false, startedAt: null } });
  await setBlocking(false);
}

export async function reconcileFocus(): Promise<void> {
  if (!(await getLocal("focus")).on) return;
  await scheduleFocusNudge(false);
  await scheduleHeadsUp();
}

export function registerFocusHandlers(): void {
  registerHandler("focus/set", async ({ on, endBy }) => {
    await setFocus(on, endBy);
    return { ok: true };
  });

  registerHandler("blocking/set", async ({ on }) => {
    await setBlocking(on);
    return { ok: true };
  });

  onTimerEvent(async (e) => {
    if (e.type === "stopped") await setFocus(false);
  });

  onAlarm(NUDGE_ALARM, async () => {
    const timer = await getLocal("timer");
    if (timer.phase !== "work" || timer.pausedAt !== null) return;
    const [tasks, activeTaskId] = await Promise.all([
      getLocal("tasks"),
      getLocal("activeTaskId"),
    ]);
    const step = firstOpenStep(findActiveTask(tasks, activeTaskId));
    await showNudge(step ? `Still on "${step.title}"?` : "Still on it?");
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (!isSettingsChange(changes, area)) return;
    void enqueue(async () => {
      if (await getLocal("blockingOn")) await reapplyBlocking();
      if ((await getLocal("focus")).on) await scheduleFocusNudge(false);
    });
  });
}

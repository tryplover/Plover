import { browser } from "wxt/browser";
import { getLocal, getSettings, setLocal } from "@/lib/storage";
import { onAlarm } from "./alarms";
import { setBlocking, reapplyBlocking } from "./blocking";
import { registerHandler } from "./controller";
import { enqueue } from "./queue";
import { onTimerEvent, resumeTimerNow, startTimerNow } from "./timer";

const NUDGE_ALARM = "focus-nudge";
const NUDGE_VISIBLE_MS = 60_000;

async function setFocus(on: boolean, endBy?: number): Promise<void> {
  if (on) {
    const timer = await getLocal("timer");
    if (timer.phase === "idle") await startTimerNow(endBy);
    else if (timer.pausedAt !== null) await resumeTimerNow();
    await setBlocking(true);
    await setLocal({ focus: { on: true, startedAt: Date.now() } });
    const { focusNudgeMinutes } = await getSettings();
    await browser.alarms.create(NUDGE_ALARM, {
      periodInMinutes: focusNudgeMinutes,
    });
    return;
  }
  await browser.alarms.clear(NUDGE_ALARM);
  await setLocal({ focus: { on: false, startedAt: null } });
  await setBlocking(false);
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
    const [tasks, activeTaskId, transient] = await Promise.all([
      getLocal("tasks"),
      getLocal("activeTaskId"),
      getLocal("transient"),
    ]);
    const step = tasks
      .find((t) => t.id === activeTaskId)
      ?.steps.find((s) => !s.done);
    await setLocal({
      transient: {
        ...transient,
        nudgeText: step ? `Still on "${step.title}"?` : "Still on it?",
        nudgeUntil: Date.now() + NUDGE_VISIBLE_MS,
      },
    });
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes["settings"]) return;
    void enqueue(async () => {
      if (await getLocal("blockingOn")) await reapplyBlocking();
      if ((await getLocal("focus")).on) {
        const { focusNudgeMinutes } = await getSettings();
        await browser.alarms.create(NUDGE_ALARM, {
          periodInMinutes: focusNudgeMinutes,
        });
      }
    });
  });
}

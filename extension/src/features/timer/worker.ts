import { browser } from "wxt/browser";
import { isBuddyVisible } from "@/features/buddy/visibility";
import { getLocal, getSettings, setLocal, timerConfig } from "@/shared/storage";
import {
  pauseTimer,
  resumeTimer,
  skipPhase,
  startTimer,
  stopTimer,
  tick,
} from "@/features/timer/machine";
import type { TimerEvent, TimerTransition } from "@/features/timer/types";
import { bookkeep } from "@/features/timer/bookkeeping";
import { onAlarm } from "@/worker/alarms";
import { updateBadge } from "@/features/timer/badge";
import { registerHandler } from "@/worker/controller";

const PHASE_ALARM = "timer-phase";
const CHECKIN_NOTIFICATION = "checkin";

export async function notifyCheckIn(): Promise<void> {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (isBuddyVisible(tab?.url, await getSettings())) return;
  await browser.notifications.create(CHECKIN_NOTIFICATION, {
    type: "basic",
    iconUrl: browser.runtime.getURL("/icon/128.png"),
    title: "Which step did you finish?",
    message: "Open Plover to check in.",
  });
}

const listeners: ((e: TimerEvent) => Promise<void>)[] = [];

export function onTimerEvent(fn: (e: TimerEvent) => Promise<void>): void {
  listeners.push(fn);
}

export async function applyTransition(
  t: TimerTransition,
  nowMs: number,
): Promise<void> {
  const [prev, phaseStartedAt, activeTaskId, sessions, transient] =
    await Promise.all([
      getLocal("timer"),
      getLocal("phaseStartedAt"),
      getLocal("activeTaskId"),
      getLocal("sessions"),
      getLocal("transient"),
    ]);

  const book = bookkeep(
    prev,
    t,
    { phaseStartedAt, activeTaskId, sessions, transient },
    nowMs,
    () => crypto.randomUUID(),
  );

  await setLocal({
    timer: t.state,
    phaseStartedAt: book.phaseStartedAt,
    sessions: book.sessions,
    transient: book.transient,
  });
  if (t.events.some((e) => e.type === "stopped"))
    await browser.notifications.clear(CHECKIN_NOTIFICATION);

  if (t.state.phase === "idle" || t.state.pausedAt !== null) {
    await browser.alarms.clear(PHASE_ALARM);
  } else {
    await browser.alarms.create(PHASE_ALARM, { when: t.state.phaseEndsAt });
  }
  await updateBadge(t.state, nowMs);

  for (const event of t.events) {
    for (const fn of listeners) await fn(event);
  }
}

export async function startTimerNow(endBy?: number): Promise<void> {
  const timer = await getLocal("timer");
  if (timer.phase !== "idle") return;
  const now = Date.now();
  const t = startTimer(timerConfig(await getSettings()), now);
  if (endBy !== undefined && endBy > now) {
    t.state = { ...t.state, phaseEndsAt: endBy };
  }
  await applyTransition(t, now);
}

export async function resumeTimerNow(): Promise<void> {
  const now = Date.now();
  await applyTransition(resumeTimer(await getLocal("timer"), now), now);
}

async function openCheckIn(): Promise<void> {
  try {
    await browser.action.openPopup();
  } catch {
    await browser.runtime.openOptionsPage();
  }
}

export function registerTimerHandlers(): void {
  browser.notifications.onClicked.addListener((id) => {
    if (id !== CHECKIN_NOTIFICATION) return;
    void browser.notifications.clear(CHECKIN_NOTIFICATION);
    void openCheckIn();
  });

  registerHandler("timer/start", async (cmd) => {
    await startTimerNow(cmd.endBy);
    return { ok: true };
  });

  registerHandler("timer/pause", async () => {
    const now = Date.now();
    await applyTransition(pauseTimer(await getLocal("timer"), now), now);
    return { ok: true };
  });

  registerHandler("timer/resume", async () => {
    await resumeTimerNow();
    return { ok: true };
  });

  registerHandler("timer/skip", async () => {
    const now = Date.now();
    const config = timerConfig(await getSettings());
    await applyTransition(skipPhase(await getLocal("timer"), config, now), now);
    return { ok: true };
  });

  registerHandler("timer/stop", async () => {
    const now = Date.now();
    await applyTransition(stopTimer(await getLocal("timer")), now);
    return { ok: true };
  });

  onAlarm(PHASE_ALARM, async () => {
    const now = Date.now();
    const config = timerConfig(await getSettings());
    await applyTransition(tick(await getLocal("timer"), config, now), now);
  });
}

export async function reconcileTimer(): Promise<void> {
  const now = Date.now();
  const config = timerConfig(await getSettings());
  await applyTransition(tick(await getLocal("timer"), config, now), now);
}

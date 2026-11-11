import { browser } from "wxt/browser";
import { isBuddyVisible } from "@/features/buddy/visibility";
import { parkedFrom } from "@/features/tasks/parking";
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
const JUST_FIVE_ALARM = "just-five";
const JUST_FIVE_MS = 5 * 60_000;
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
  reason?: "skip",
): Promise<void> {
  const [
    prev,
    phaseStartedAt,
    activeTaskId,
    tasks,
    cycleId,
    phasePausedMs,
    sessions,
    transient,
  ] = await Promise.all([
    getLocal("timer"),
    getLocal("phaseStartedAt"),
    getLocal("activeTaskId"),
    getLocal("tasks"),
    getLocal("cycleId"),
    getLocal("phasePausedMs"),
    getLocal("sessions"),
    getLocal("transient"),
  ]);
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const activeTaskTitle = activeTask?.title ?? null;
  const hasOpenStep = activeTask?.steps.some((s) => !s.done) ?? false;

  const book = bookkeep(
    prev,
    t,
    {
      phaseStartedAt,
      activeTaskId,
      activeTaskTitle,
      hasOpenStep,
      cycleId,
      phasePausedMs,
      sessions,
      transient,
    },
    nowMs,
    () => crypto.randomUUID(),
    reason,
  );

  const leftWork = t.state.phase !== "work";
  await setLocal({
    timer: t.state,
    phaseStartedAt: book.phaseStartedAt,
    cycleId: book.cycleId,
    phasePausedMs: book.phasePausedMs,
    sessions: book.sessions,
    transient: leftWork
      ? { ...book.transient, extendOffer: false }
      : book.transient,
    ...(leftWork ? { justFiveUntil: null } : {}),
  });
  if (leftWork) await browser.alarms.clear(JUST_FIVE_ALARM);
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

export async function startTimerNow(
  endBy?: number,
  blocksCompleted?: number,
  justFive?: boolean,
): Promise<void> {
  const timer = await getLocal("timer");
  if (timer.phase !== "idle") return;
  const now = Date.now();
  const t = startTimer(timerConfig(await getSettings()), now, {
    endBy,
    blocksCompleted,
  });
  await applyTransition(t, now);
  if (justFive) {
    const until = now + JUST_FIVE_MS;
    await setLocal({ justFiveUntil: until });
    await browser.alarms.create(JUST_FIVE_ALARM, { when: until });
  }
}

async function settleJustFive(now: number): Promise<void> {
  const [timer, until] = await Promise.all([
    getLocal("timer"),
    getLocal("justFiveUntil"),
  ]);
  if (until === null) return;
  await setLocal({ justFiveUntil: null });
  if (timer.phase !== "work" || timer.pausedAt !== null || now < until - 1000)
    return;
  await applyTransition(pauseTimer(timer, now), now);
  await setLocal({
    transient: { ...(await getLocal("transient")), extendOffer: true },
  });
}

export async function resumeTimerNow(): Promise<void> {
  const now = Date.now();
  const timer = await getLocal("timer");
  const transient = await getLocal("transient");
  if (transient.extendOffer)
    await setLocal({ transient: { ...transient, extendOffer: false } });
  if (timer.pausedAt !== null) {
    await setLocal({
      phasePausedMs: (await getLocal("phasePausedMs")) + now - timer.pausedAt,
    });
  }
  await applyTransition(resumeTimer(timer, now), now);
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
    await startTimerNow(cmd.endBy, undefined, cmd.justFive);
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
    if (await settleOverdue(now)) return { ok: true };
    const config = timerConfig(await getSettings());
    await applyTransition(
      skipPhase(await getLocal("timer"), config, now),
      now,
      "skip",
    );
    return { ok: true };
  });

  registerHandler("timer/stop", async () => {
    const now = Date.now();
    await stopAndPark(now);
    return { ok: true };
  });

  registerHandler("timer/keepGoing", async () => {
    if (!(await getLocal("transient")).extendOffer) return { ok: true };
    await resumeTimerNow();
    return { ok: true };
  });

  registerHandler("timer/stopHere", async () => {
    await stopAndPark(Date.now());
    return { ok: true };
  });

  onAlarm(JUST_FIVE_ALARM, () => settleJustFive(Date.now()));

  onAlarm(PHASE_ALARM, async () => {
    const now = Date.now();
    const config = timerConfig(await getSettings());
    await applyTransition(tick(await getLocal("timer"), config, now), now);
  });
}

async function settleOverdue(now: number): Promise<boolean> {
  const config = timerConfig(await getSettings());
  const t = tick(await getLocal("timer"), config, now);
  if (t.events.length === 0) return false;
  await applyTransition(t, now);
  return true;
}

export async function stopAndPark(now: number): Promise<void> {
  await settleOverdue(now);
  const config = timerConfig(await getSettings());
  const [timer, activeTaskId, tasks, before] = await Promise.all([
    getLocal("timer"),
    getLocal("activeTaskId"),
    getLocal("tasks"),
    getLocal("transient"),
  ]);
  await applyTransition(stopTimer(timer), now);
  const checkInTaskId = before.checkInTaskId ?? activeTaskId;
  if (before.checkInPending && checkInTaskId) {
    await setLocal({
      transient: {
        ...(await getLocal("transient")),
        checkInPending: true,
        checkInTaskId,
      },
    });
  }
  await setLocal({
    activeTaskId: null,
    tasks: tasks.map((t) =>
      t.id !== activeTaskId
        ? t
        : {
            ...t,
            parked: t.doneAt === null ? parkedFrom(timer, config, now) : null,
            lastActiveAt: now,
          },
    ),
  });
}

export async function reconcileTimer(): Promise<void> {
  const now = Date.now();
  const config = timerConfig(await getSettings());
  await applyTransition(tick(await getLocal("timer"), config, now), now);
  const until = await getLocal("justFiveUntil");
  if (until === null) return;
  if (until > now) {
    await browser.alarms.create(JUST_FIVE_ALARM, { when: until });
  } else {
    await settleJustFive(now);
  }
}

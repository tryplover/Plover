import { browser } from "wxt/browser";
import { getLocal, getSettings, setLocal, timerConfig } from "@/lib/storage";
import {
  pauseTimer,
  resumeTimer,
  skipPhase,
  startTimer,
  stopTimer,
  tick,
} from "@/lib/timer/machine";
import type { TimerEvent, TimerTransition } from "@/lib/timer/types";
import type { Session } from "@/lib/types";
import { onAlarm } from "./alarms";
import { updateBadge } from "./badge";
import { registerHandler } from "./controller";

const PHASE_ALARM = "timer-phase";

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

  const completedBlock = t.events.some(
    (e) => e.type === "work-block-completed",
  );
  const nextSessions = [...sessions];
  if (prev.phase === "work" && t.state.phase !== "work") {
    const session: Session = {
      id: crypto.randomUUID(),
      taskId: activeTaskId,
      phase: "work",
      startedAt: phaseStartedAt ?? nowMs,
      endedAt: completedBlock ? prev.phaseEndsAt : (prev.pausedAt ?? nowMs),
      completed: completedBlock,
    };
    nextSessions.push(session);
  }

  await setLocal({
    timer: t.state,
    phaseStartedAt:
      t.state.phase === "idle"
        ? null
        : t.events.some((e) => e.type === "phase-started")
          ? nowMs
          : phaseStartedAt,
    sessions: nextSessions,
    transient: completedBlock
      ? { ...transient, checkInPending: true }
      : transient,
  });

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

export function registerTimerHandlers(): void {
  registerHandler("timer/start", async (cmd) => {
    const timer = await getLocal("timer");
    if (timer.phase !== "idle") return { ok: true };
    const now = Date.now();
    const t = startTimer(timerConfig(await getSettings()), now);
    if (cmd.endBy !== undefined && cmd.endBy > now) {
      t.state = { ...t.state, phaseEndsAt: cmd.endBy };
    }
    await applyTransition(t, now);
    return { ok: true };
  });

  registerHandler("timer/pause", async () => {
    const now = Date.now();
    await applyTransition(pauseTimer(await getLocal("timer"), now), now);
    return { ok: true };
  });

  registerHandler("timer/resume", async () => {
    const now = Date.now();
    await applyTransition(resumeTimer(await getLocal("timer"), now), now);
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

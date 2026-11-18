import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/features/auth/session")>()),
  isSignedIn: async () => true,
}));
import { registerBadge } from "@/features/timer/badge";
import { dispatch } from "@/worker/controller";
import {
  notifyCheckIn,
  onTimerEvent,
  reconcileTimer,
  registerTimerHandlers,
} from "@/features/timer/worker";
import { setLocal } from "@/shared/storage";
import { getLocal } from "@/shared/storage";
import type { TimerEvent } from "@/features/timer/types";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

async function seedOpenTask() {
  await setLocal({
    tasks: [
      {
        id: "t1",
        title: "T",
        createdAt: T0,
        doneAt: null,
        steps: [{ id: "s1", title: "Step", done: false }],
      },
    ],
    activeTaskId: "t1",
  });
}

async function fireAlarm(name: string) {
  const alarm = await fakeBrowser.alarms.get(name);
  await fakeBrowser.alarms.onAlarm.trigger(
    alarm ?? { name, scheduledTime: Date.now(), persistAcrossSessions: false },
  );
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  registerTimerHandlers();
  registerBadge();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("timer commands", () => {
  it("start enters work and schedules the phase alarm at phaseEndsAt", async () => {
    await dispatch({ type: "timer/start" });
    const timer = await getLocal("timer");
    expect(timer.phase).toBe("work");
    expect(timer.phaseEndsAt).toBe(T0 + 25 * MIN);
    const alarm = await fakeBrowser.alarms.get("timer-phase");
    expect(alarm?.scheduledTime).toBe(timer.phaseEndsAt);
  });

  it("start with endBy shortens the first phase", async () => {
    const endBy = T0 + 10 * MIN;
    await dispatch({ type: "timer/start", endBy });
    expect((await getLocal("timer")).phaseEndsAt).toBe(endBy);
    expect((await fakeBrowser.alarms.get("timer-phase"))?.scheduledTime).toBe(
      endBy,
    );
  });

  it("start while running is a no-op", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + MIN);
    await dispatch({ type: "timer/start" });
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 25 * MIN);
  });

  it("alarm after the end sets no check-in when no task is active", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN + 1000);
    await fireAlarm("timer-phase");
    expect((await getLocal("transient")).checkInPending).toBe(false);
    expect(await getLocal("sessions")).toHaveLength(1);
  });

  it("alarm after the end sets no check-in when every step is done", async () => {
    await seedOpenTask();
    const tasks = await getLocal("tasks");
    await setLocal({
      tasks: tasks.map((t) => ({
        ...t,
        steps: t.steps.map((st) => ({ ...st, done: true })),
      })),
    });
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN + 1000);
    await fireAlarm("timer-phase");
    expect((await getLocal("transient")).checkInPending).toBe(false);
  });

  it("alarm after the end moves to a short break, flags check-in and records a session", async () => {
    const events: TimerEvent[] = [];
    onTimerEvent(async (e) => void events.push(e));
    await seedOpenTask();
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN + 1000);
    await fireAlarm("timer-phase");

    const timer = await getLocal("timer");
    expect(timer.phase).toBe("shortBreak");
    expect(timer.blocksCompleted).toBe(1);
    expect((await getLocal("transient")).checkInPending).toBe(true);
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      phase: "work",
      completed: true,
      startedAt: T0,
      endedAt: T0 + 25 * MIN,
    });
    expect(events.map((e) => e.type)).toContain("work-block-completed");
    expect((await fakeBrowser.alarms.get("timer-phase"))?.scheduledTime).toBe(
      timer.phaseEndsAt,
    );
  });

  it("pause clears the phase alarm and resume recreates it shifted", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 5 * MIN);
    await dispatch({ type: "timer/pause" });
    expect(await fakeBrowser.alarms.get("timer-phase")).toBeUndefined();
    vi.setSystemTime(T0 + 15 * MIN);
    await dispatch({ type: "timer/resume" });
    const alarm = await fakeBrowser.alarms.get("timer-phase");
    expect(alarm?.scheduledTime).toBe(T0 + 35 * MIN);
  });

  it("stop clears alarms and records an incomplete session", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 7 * MIN);
    await dispatch({ type: "timer/stop" });
    expect((await getLocal("timer")).phase).toBe("idle");
    expect(await fakeBrowser.alarms.getAll()).toEqual([]);
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      completed: false,
      startedAt: T0,
      endedAt: T0 + 7 * MIN,
    });
  });

  it("skip from work records an incomplete session and enters a break", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + MIN);
    await dispatch({ type: "timer/skip" });
    expect((await getLocal("timer")).phase).toBe("shortBreak");
    expect((await getLocal("sessions"))[0]?.completed).toBe(false);
  });

  it("stop after the block ended but before the alarm records a completed block", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 26 * MIN);
    await dispatch({ type: "timer/stop" });
    expect((await getLocal("timer")).phase).toBe("idle");
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      completed: true,
      endedAt: T0 + 25 * MIN,
    });
    expect(await getLocal("cycleId")).toBeNull();
  });

  it("records pause time, a shared cycle id, task title and skipped flag", async () => {
    await setLocal({
      tasks: [
        {
          id: "t1",
          title: "Write report",
          steps: [],
          createdAt: 0,
          doneAt: null,
        },
      ],
      activeTaskId: "t1",
    });
    await dispatch({ type: "timer/start" });
    const cycle = await getLocal("cycleId");
    expect(cycle).not.toBeNull();
    vi.setSystemTime(T0 + 5 * MIN);
    await dispatch({ type: "timer/pause" });
    vi.setSystemTime(T0 + 8 * MIN);
    await dispatch({ type: "timer/resume" });
    expect(await getLocal("phasePausedMs")).toBe(3 * MIN);
    vi.setSystemTime(T0 + 30 * MIN);
    await dispatch({ type: "timer/skip" });
    vi.setSystemTime(T0 + 32 * MIN);
    await dispatch({ type: "timer/skip" });
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      phase: "work",
      completed: true,
      pausedMs: 3 * MIN,
      cycleId: cycle,
      taskTitle: "Write report",
    });
    expect(sessions[1]).toMatchObject({
      phase: "shortBreak",
      skipped: true,
      cycleId: cycle,
      pausedMs: 0,
    });
    expect(await getLocal("phasePausedMs")).toBe(0);
    expect(await getLocal("cycleId")).toBe(cycle);
  });

  it("skip after the block ended only completes it", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 26 * MIN);
    await dispatch({ type: "timer/skip" });
    const timer = await getLocal("timer");
    expect(timer.phase).toBe("shortBreak");
    expect(timer.blocksCompleted).toBe(1);
    expect((await getLocal("sessions"))[0]?.completed).toBe(true);
  });

  it("shows remaining minutes on the badge and clears it when idle", async () => {
    const spy = vi.spyOn(fakeBrowser.action, "setBadgeText");
    await dispatch({ type: "timer/start" });
    expect(spy).toHaveBeenLastCalledWith({ text: "25" });
    expect((await fakeBrowser.alarms.get("badge"))?.periodInMinutes).toBe(1);
    vi.setSystemTime(T0 + 10 * MIN);
    await fireAlarm("badge");
    expect(spy).toHaveBeenLastCalledWith({ text: "15" });
    await dispatch({ type: "timer/stop" });
    expect(spy).toHaveBeenLastCalledWith({ text: "" });
    expect(await fakeBrowser.alarms.get("badge")).toBeUndefined();
  });

  it("returns ok:false for an unknown command", async () => {
    const result = await dispatch({ type: "calendar/connect" });
    expect(result.ok).toBe(false);
  });

  it("endBy session starts at the real start time", async () => {
    await dispatch({ type: "timer/start", endBy: T0 + 10 * MIN });
    vi.setSystemTime(T0 + 4 * MIN);
    await dispatch({ type: "timer/stop" });
    const [session] = await getLocal("sessions");
    expect(session).toMatchObject({ startedAt: T0, endedAt: T0 + 4 * MIN });
  });

  it("pause then stop records the real start and excludes paused time", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 5 * MIN);
    await dispatch({ type: "timer/pause" });
    vi.setSystemTime(T0 + 20 * MIN);
    await dispatch({ type: "timer/resume" });
    vi.setSystemTime(T0 + 22 * MIN);
    await dispatch({ type: "timer/pause" });
    vi.setSystemTime(T0 + 40 * MIN);
    await dispatch({ type: "timer/stop" });
    const [session] = await getLocal("sessions");
    expect(session).toMatchObject({ startedAt: T0, endedAt: T0 + 22 * MIN });
  });

  it("reconcile advances an overdue stored timer once and recreates alarms", async () => {
    await setLocal({
      timer: {
        phase: "work",
        phaseEndsAt: T0 - MIN,
        blocksCompleted: 0,
        pausedAt: null,
      },
      phaseStartedAt: T0 - 26 * MIN,
    });
    await reconcileTimer();
    const timer = await getLocal("timer");
    expect(timer.phase).toBe("shortBreak");
    expect(timer.blocksCompleted).toBe(1);
    expect(await getLocal("sessions")).toHaveLength(1);
    expect((await fakeBrowser.alarms.get("timer-phase"))?.scheduledTime).toBe(
      timer.phaseEndsAt,
    );
    expect(await fakeBrowser.alarms.get("badge")).toBeDefined();
  });

  it("reconcile recreates alarms for a running timer without transitioning", async () => {
    await dispatch({ type: "timer/start" });
    await fakeBrowser.alarms.clearAll();
    await reconcileTimer();
    expect((await getLocal("timer")).phase).toBe("work");
    expect(await fakeBrowser.alarms.get("timer-phase")).toBeDefined();
  });

  it("serialises an alarm and a command fired together", async () => {
    await seedOpenTask();
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN + 1000);
    await Promise.all([
      fakeBrowser.alarms.onAlarm.trigger({
        name: "timer-phase",
        scheduledTime: Date.now(),
        persistAcrossSessions: false,
      }),
      dispatch({ type: "timer/skip" }),
    ]);
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.completed).toBe(true);
    expect((await getLocal("transient")).checkInPending).toBe(true);
    expect((await getLocal("timer")).phase).toBe("work");
  });
});

describe("check-in notification", () => {
  afterEach(() => vi.restoreAllMocks());

  async function run(url: string | undefined) {
    const create = vi.spyOn(fakeBrowser.notifications, "create");
    const tabs = (url === undefined ? [] : [{ url }]) as chrome.tabs.Tab[];
    vi.spyOn(fakeBrowser.tabs, "query").mockImplementation(
      (async () => tabs) as never,
    );
    await notifyCheckIn();
    return create;
  }

  it("is skipped when the buddy is visible on the active tab", async () => {
    const create = await run("https://example.com/");
    expect(create).not.toHaveBeenCalled();
  });

  it("is created on chrome:// pages", async () => {
    const create = await run("chrome://newtab");
    expect(create).toHaveBeenCalledWith(
      "checkin",
      expect.objectContaining({ type: "basic" }),
    );
  });

  it("is created when there is no active tab", async () => {
    const create = await run(undefined);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("check-in cleanup", () => {
  it("timer/stop clears a pending check-in and its notification", async () => {
    await dispatch({ type: "timer/start" });
    await setLocal({
      transient: {
        checkInPending: true,
        checkInTaskId: null,
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
        extendOffer: false,
        awaitingStart: false,
      },
    });
    await fakeBrowser.notifications.create("checkin", {
      type: "basic",
      iconUrl: "x",
      title: "t",
      message: "m",
    });
    await dispatch({ type: "timer/stop" });
    expect((await getLocal("transient")).checkInPending).toBe(false);
    expect(fakeBrowser.notifications.getAllCreateOptions()).toEqual({});
  });
});

describe("check-in notification click", () => {
  afterEach(() => vi.restoreAllMocks());

  async function create() {
    await fakeBrowser.notifications.create("checkin", {
      type: "basic",
      iconUrl: "x",
      title: "t",
      message: "m",
    });
  }

  it("opens the popup and clears the notification", async () => {
    const openPopup = vi.fn(async () => undefined);
    Object.assign(fakeBrowser.action, { openPopup });
    await create();
    await fakeBrowser.notifications.onClicked.trigger("checkin");
    await vi.waitFor(() => expect(openPopup).toHaveBeenCalled());
    expect(fakeBrowser.notifications.getAllCreateOptions()).toEqual({});
  });

  it("falls back to the options page when the popup cannot open", async () => {
    Object.assign(fakeBrowser.action, {
      openPopup: vi.fn(async () => {
        throw new Error("no window");
      }),
    });
    const openOptionsPage = vi.fn(async () => undefined);
    Object.assign(fakeBrowser.runtime, { openOptionsPage });
    await create();
    await fakeBrowser.notifications.onClicked.trigger("checkin");
    await vi.waitFor(() => expect(openOptionsPage).toHaveBeenCalled());
  });

  it("ignores other notifications", async () => {
    const openPopup = vi.fn(async () => undefined);
    Object.assign(fakeBrowser.action, { openPopup });
    await fakeBrowser.notifications.onClicked.trigger("other");
    expect(openPopup).not.toHaveBeenCalled();
  });
});

describe("just 5 min", () => {
  async function startJustFive() {
    await setLocal({
      tasks: [{ id: "t1", title: "T", steps: [], createdAt: 0, doneAt: null }],
      activeTaskId: "t1",
    });
    await dispatch({ type: "timer/start", justFive: true });
  }

  it("pauses at 5 minutes and offers to keep going", async () => {
    await startJustFive();
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 25 * MIN);
    expect((await fakeBrowser.alarms.get("just-five"))?.scheduledTime).toBe(
      T0 + 5 * MIN,
    );
    vi.setSystemTime(T0 + 5 * MIN);
    await fireAlarm("just-five");
    expect((await getLocal("timer")).pausedAt).toBe(T0 + 5 * MIN);
    expect((await getLocal("transient")).extendOffer).toBe(true);
    expect(await getLocal("justFiveUntil")).toBeNull();
  });

  it("keepGoing resumes and clears the offer", async () => {
    await startJustFive();
    vi.setSystemTime(T0 + 5 * MIN);
    await fireAlarm("just-five");
    vi.setSystemTime(T0 + 6 * MIN);
    await dispatch({ type: "timer/keepGoing" });
    const timer = await getLocal("timer");
    expect(timer.pausedAt).toBeNull();
    expect(timer.phaseEndsAt).toBe(T0 + 26 * MIN);
    expect((await getLocal("transient")).extendOffer).toBe(false);
  });

  it("plain Resume also clears the offer", async () => {
    await startJustFive();
    vi.setSystemTime(T0 + 5 * MIN);
    await fireAlarm("just-five");
    await dispatch({ type: "timer/resume" });
    expect((await getLocal("timer")).pausedAt).toBeNull();
    expect((await getLocal("transient")).extendOffer).toBe(false);
  });

  it("stopHere parks the task and records an incomplete session", async () => {
    await startJustFive();
    vi.setSystemTime(T0 + 5 * MIN);
    await fireAlarm("just-five");
    await dispatch({ type: "timer/stopHere" });
    expect((await getLocal("timer")).phase).toBe("idle");
    expect((await getLocal("transient")).extendOffer).toBe(false);
    const [task] = await getLocal("tasks");
    expect(task?.parked).not.toBeNull();
    expect(await getLocal("activeTaskId")).toBeNull();
    const sessions = await getLocal("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      completed: false,
      endedAt: T0 + 5 * MIN,
    });
  });

  it("stop before 5 minutes clears the alarm and nothing fires", async () => {
    await startJustFive();
    vi.setSystemTime(T0 + 2 * MIN);
    await dispatch({ type: "timer/stop" });
    expect(await fakeBrowser.alarms.get("just-five")).toBeUndefined();
    expect(await getLocal("justFiveUntil")).toBeNull();
    vi.setSystemTime(T0 + 5 * MIN);
    await fireAlarm("just-five");
    expect((await getLocal("timer")).phase).toBe("idle");
    expect((await getLocal("transient")).extendOffer).toBe(false);
  });

  it("skip clears the pending just-five", async () => {
    await startJustFive();
    await dispatch({ type: "timer/skip" });
    expect(await fakeBrowser.alarms.get("just-five")).toBeUndefined();
    expect(await getLocal("justFiveUntil")).toBeNull();
  });

  it("reconcile with a past justFiveUntil pauses with the offer", async () => {
    await startJustFive();
    await fakeBrowser.alarms.clearAll();
    vi.setSystemTime(T0 + 8 * MIN);
    await reconcileTimer();
    expect((await getLocal("timer")).pausedAt).toBe(T0 + 8 * MIN);
    expect((await getLocal("transient")).extendOffer).toBe(true);
  });

  it("reconcile with a future justFiveUntil recreates the alarm", async () => {
    await startJustFive();
    await fakeBrowser.alarms.clearAll();
    vi.setSystemTime(T0 + MIN);
    await reconcileTimer();
    expect((await fakeBrowser.alarms.get("just-five"))?.scheduledTime).toBe(
      T0 + 5 * MIN,
    );
  });
});

describe("waiting after a break", () => {
  async function toBreakEnd(opts: { autoStartWork?: boolean } = {}) {
    if (opts.autoStartWork)
      await fakeBrowser.storage.sync.set({
        settings: { autoStartWork: true },
      });
    await seedOpenTask();
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN);
    await fireAlarm("timer-phase");
    vi.setSystemTime(T0 + 30 * MIN);
  }

  it("by default the next block waits: paused at its start, awaitingStart set, no alarm or badge", async () => {
    const badge = vi.spyOn(fakeBrowser.action, "setBadgeText");
    await toBreakEnd();
    await fireAlarm("timer-phase");
    const timer = await getLocal("timer");
    expect(timer).toMatchObject({
      phase: "work",
      pausedAt: T0 + 30 * MIN,
      phaseEndsAt: T0 + 55 * MIN,
    });
    expect((await getLocal("transient")).awaitingStart).toBe(true);
    expect(await fakeBrowser.alarms.get("timer-phase")).toBeUndefined();
    expect(badge).toHaveBeenLastCalledWith({ text: "" });
  });

  it("autoStartWork with the check-in answered starts the block running", async () => {
    await toBreakEnd({ autoStartWork: true });
    await setLocal({
      transient: { ...(await getLocal("transient")), checkInPending: false },
    });
    await fireAlarm("timer-phase");
    expect(await getLocal("timer")).toMatchObject({
      phase: "work",
      pausedAt: null,
      phaseEndsAt: T0 + 55 * MIN,
    });
    expect((await getLocal("transient")).awaitingStart).toBe(false);
  });

  it("autoStartWork still waits when the check-in is unanswered", async () => {
    await toBreakEnd({ autoStartWork: true });
    expect((await getLocal("transient")).checkInPending).toBe(true);
    await fireAlarm("timer-phase");
    expect((await getLocal("timer")).pausedAt).toBe(T0 + 30 * MIN);
    expect((await getLocal("transient")).awaitingStart).toBe(true);
  });

  it("Start after 2 h runs a full block and History records the real start with no paused time", async () => {
    const badge = vi.spyOn(fakeBrowser.action, "setBadgeText");
    await toBreakEnd();
    await fireAlarm("timer-phase");
    vi.setSystemTime(T0 + 30 * MIN + 120 * MIN);
    await dispatch({ type: "timer/resume" });
    const timer = await getLocal("timer");
    expect(timer.pausedAt).toBeNull();
    expect(timer.phaseEndsAt).toBe(T0 + 150 * MIN + 25 * MIN);
    expect((await getLocal("transient")).awaitingStart).toBe(false);
    expect((await fakeBrowser.alarms.get("timer-phase"))?.scheduledTime).toBe(
      timer.phaseEndsAt,
    );
    expect(badge).toHaveBeenLastCalledWith({ text: "25" });

    vi.setSystemTime(timer.phaseEndsAt);
    await fireAlarm("timer-phase");
    const sessions = await getLocal("sessions");
    expect(sessions.map((x) => [x.phase, x.completed])).toEqual([
      ["work", true],
      ["shortBreak", true],
      ["work", true],
    ]);
    expect(sessions[1]).toMatchObject({
      startedAt: T0 + 25 * MIN,
      endedAt: T0 + 30 * MIN,
    });
    expect(sessions[2]).toMatchObject({
      startedAt: T0 + 150 * MIN,
      endedAt: T0 + 175 * MIN,
      pausedMs: 0,
    });
  });

  it("stopping while waiting records no work session and clears the flag", async () => {
    await toBreakEnd();
    await fireAlarm("timer-phase");
    vi.setSystemTime(T0 + 300 * MIN);
    await dispatch({ type: "timer/stop" });
    const sessions = await getLocal("sessions");
    expect(sessions.map((x) => x.phase)).toEqual(["work", "shortBreak"]);
    expect((await getLocal("transient")).awaitingStart).toBe(false);
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("skipping while waiting clears the flag and records nothing for the unstarted block", async () => {
    await toBreakEnd();
    await fireAlarm("timer-phase");
    await dispatch({ type: "timer/skip" });
    expect((await getLocal("transient")).awaitingStart).toBe(false);
    expect((await getLocal("sessions")).map((x) => x.phase)).toEqual([
      "work",
      "shortBreak",
    ]);
  });

  it("a worker waking 3 days after the break ended adds no work session", async () => {
    await toBreakEnd();
    vi.setSystemTime(T0 + 3 * 24 * 60 * MIN);
    await reconcileTimer();
    const sessions = await getLocal("sessions");
    expect(sessions.filter((x) => x.phase === "work")).toHaveLength(1);
    expect((await getLocal("timer")).pausedAt).toBe(T0 + 3 * 24 * 60 * MIN);
    expect((await getLocal("transient")).awaitingStart).toBe(true);
  });

  it("with autoStartWork and an answered check-in, waking 3 days late adds at most one block", async () => {
    await toBreakEnd({ autoStartWork: true });
    await setLocal({
      transient: { ...(await getLocal("transient")), checkInPending: false },
    });
    const wake = T0 + 3 * 24 * 60 * MIN;
    vi.setSystemTime(wake);
    await reconcileTimer();
    await reconcileTimer();
    const sessions = await getLocal("sessions");
    expect(sessions.filter((x) => x.phase === "work")).toHaveLength(1);
    expect(await getLocal("timer")).toMatchObject({
      phase: "work",
      pausedAt: null,
      phaseEndsAt: wake + 25 * MIN,
    });
  });
});

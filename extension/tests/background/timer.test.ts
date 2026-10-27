import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  isSignedIn: async () => true,
}));
import { registerBadge } from "@/background/badge";
import { dispatch } from "@/background/controller";
import {
  notifyCheckIn,
  onTimerEvent,
  reconcileTimer,
  registerTimerHandlers,
} from "@/background/timer";
import { setLocal } from "@/lib/storage";
import { getLocal } from "@/lib/storage";
import type { TimerEvent } from "@/lib/timer/types";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

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

  it("alarm after the end moves to a short break, flags check-in and records a session", async () => {
    const events: TimerEvent[] = [];
    onTimerEvent(async (e) => void events.push(e));
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
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
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

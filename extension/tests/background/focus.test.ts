import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  isSignedIn: async () => true,
}));
import { dispatch } from "@/background/controller";
import { registerFocusHandlers } from "@/background/focus";
import { registerTimerHandlers } from "@/background/timer";
import { getLocal, setLocal, updateSettings } from "@/lib/storage";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

const updateDynamicRules = vi.fn(async () => undefined);
const getDynamicRules = vi.fn(async () => [] as { id: number }[]);
const tabsQuery = vi.fn();
const tabsUpdate = vi.fn(async () => undefined);

async function fireAlarm(name: string) {
  const alarm = await fakeBrowser.alarms.get(name);
  await fakeBrowser.alarms.onAlarm.trigger(
    alarm ?? { name, scheduledTime: Date.now(), persistAcrossSessions: false },
  );
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  updateDynamicRules.mockClear();
  getDynamicRules.mockReset().mockResolvedValue([]);
  tabsQuery.mockReset().mockResolvedValue([]);
  tabsUpdate.mockClear();
  vi.stubGlobal("browser", fakeBrowser);
  const b = fakeBrowser as unknown as Record<string, unknown>;
  b.declarativeNetRequest = { updateDynamicRules, getDynamicRules };
  vi.spyOn(fakeBrowser.tabs, "query").mockImplementation(tabsQuery);
  vi.spyOn(fakeBrowser.tabs, "update").mockImplementation(tabsUpdate);
  registerTimerHandlers();
  registerFocusHandlers();
  await updateSettings({ blocklist: ["youtube.com", "reddit.com"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("focus mode", () => {
  it("starts the timer, blocking, rules, nudge alarm and redirects open tabs", async () => {
    tabsQuery.mockResolvedValue([
      { id: 7, url: "https://www.youtube.com/watch?v=1" },
      { id: 8, url: "https://example.com/" },
      { id: 9 },
    ]);
    const res = await dispatch({ type: "focus/set", on: true });
    expect(res.ok).toBe(true);
    expect((await getLocal("timer")).phase).toBe("work");
    expect(await getLocal("blockingOn")).toBe(true);
    expect((await getLocal("focus")).on).toBe(true);
    expect(updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 2 }),
      ]),
    });
    expect(tabsUpdate).toHaveBeenCalledTimes(1);
    expect(tabsUpdate).toHaveBeenCalledWith(7, {
      url: fakeBrowser.runtime.getURL("/blocked.html"),
    });
    expect((await fakeBrowser.alarms.get("focus-nudge"))?.periodInMinutes).toBe(
      15,
    );
  });

  it("honours endBy on the first phase", async () => {
    await dispatch({ type: "focus/set", on: true, endBy: T0 + 10 * MIN });
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 10 * MIN);
  });

  it("keeps a running timer and resumes a paused one", async () => {
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + MIN);
    await dispatch({ type: "timer/pause" });
    await dispatch({ type: "focus/set", on: true });
    const timer = await getLocal("timer");
    expect(timer.phase).toBe("work");
    expect(timer.pausedAt).toBeNull();
    expect((await getLocal("focus")).on).toBe(true);
  });

  it("nudge names the first unfinished step", async () => {
    await setLocal({
      tasks: [
        {
          id: "t1",
          title: "Essay",
          createdAt: T0,
          doneAt: null,
          steps: [
            { id: "s1", title: "Outline", done: true },
            { id: "s2", title: "Draft intro", done: false },
          ],
        },
      ],
      activeTaskId: "t1",
    });
    await dispatch({ type: "focus/set", on: true });
    vi.setSystemTime(T0 + 15 * MIN);
    await fireAlarm("focus-nudge");
    const transient = await getLocal("transient");
    expect(transient.nudgeText).toBe('Still on "Draft intro"?');
    expect(transient.nudgeUntil).toBe(T0 + 15 * MIN + 60_000);
  });

  it("nudge falls back to a generic prompt", async () => {
    await dispatch({ type: "focus/set", on: true });
    await fireAlarm("focus-nudge");
    expect((await getLocal("transient")).nudgeText).toBe("Still on it?");
  });

  it("nudge does nothing while paused", async () => {
    await dispatch({ type: "focus/set", on: true });
    await dispatch({ type: "timer/pause" });
    await fireAlarm("focus-nudge");
    expect((await getLocal("transient")).nudgeText).toBeNull();
  });

  it("focus off removes rules, blocking and the nudge alarm but keeps the timer", async () => {
    await dispatch({ type: "focus/set", on: true });
    getDynamicRules.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    updateDynamicRules.mockClear();
    await dispatch({ type: "focus/set", on: false });
    expect(updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [1, 2],
      addRules: [],
    });
    expect(await getLocal("blockingOn")).toBe(false);
    expect((await getLocal("focus")).on).toBe(false);
    expect(await fakeBrowser.alarms.get("focus-nudge")).toBeUndefined();
    expect((await getLocal("timer")).phase).toBe("work");
  });

  it("timer stop ends focus and blocking", async () => {
    await dispatch({ type: "focus/set", on: true });
    getDynamicRules.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await dispatch({ type: "timer/stop" });
    expect(await getLocal("blockingOn")).toBe(false);
    expect((await getLocal("focus")).on).toBe(false);
    expect(await fakeBrowser.alarms.get("focus-nudge")).toBeUndefined();
    expect(updateDynamicRules).toHaveBeenLastCalledWith({
      removeRuleIds: [1, 2],
      addRules: [],
    });
  });

  it("needsSignIn mid-focus leaves blocking on", async () => {
    await dispatch({ type: "focus/set", on: true });
    await setLocal({ needsSignIn: true });
    expect(await getLocal("blockingOn")).toBe(true);
    expect((await getLocal("focus")).on).toBe(true);
  });

  it("ending focus works while signed out", async () => {
    await dispatch({ type: "focus/set", on: true });
    await setLocal({ needsSignIn: true });
    const res = await dispatch({ type: "focus/set", on: false });
    expect(res.ok).toBe(true);
    expect(await getLocal("blockingOn")).toBe(false);
  });
});

describe("manual blocking", () => {
  it("works without a timer", async () => {
    await dispatch({ type: "blocking/set", on: true });
    expect(await getLocal("blockingOn")).toBe(true);
    expect((await getLocal("timer")).phase).toBe("idle");
    await dispatch({ type: "blocking/set", on: false });
    expect(await getLocal("blockingOn")).toBe(false);
  });

  it("re-applies rules when the blocklist changes while blocking", async () => {
    await dispatch({ type: "blocking/set", on: true });
    updateDynamicRules.mockClear();
    await updateSettings({ blocklist: ["twitter.com"] });
    await vi.waitFor(() => expect(updateDynamicRules).toHaveBeenCalled());
    const arg = updateDynamicRules.mock.calls[0] as unknown as [
      { addRules: { condition: { requestDomains: string[] } }[] },
    ];
    expect(arg[0].addRules[0]?.condition.requestDomains).toEqual([
      "twitter.com",
    ]);
  });

  it("does not touch rules on settings change when blocking is off", async () => {
    updateDynamicRules.mockClear();
    await updateSettings({ blocklist: ["twitter.com"] });
    await new Promise((r) => setTimeout(r, 20));
    expect(updateDynamicRules).not.toHaveBeenCalled();
  });
});

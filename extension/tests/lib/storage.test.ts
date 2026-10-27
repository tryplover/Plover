import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL,
  DEFAULT_SETTINGS,
  getLocal,
  getSettings,
  setLocal,
  timerConfig,
  updateSettings,
} from "@/lib/storage";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("settings", () => {
  it("returns defaults on empty storage", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      blocksPerLongBreak: 4,
      focusNudgeMinutes: 15,
      buddyCorner: "bottom-right",
    });
  });

  it("persists a patch to storage.sync under settings and keeps other defaults", async () => {
    const next = await updateSettings({ workMinutes: 50 });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, workMinutes: 50 });
    const raw = await fakeBrowser.storage.sync.get("settings");
    expect((raw.settings as { workMinutes: number }).workMinutes).toBe(50);
    expect(await getSettings()).toEqual(next);
  });

  it("stays under the 8 KB sync item limit", () => {
    expect(JSON.stringify(DEFAULT_SETTINGS).length).toBeLessThan(8192);
  });

  it("derives the timer config", () => {
    expect(timerConfig(DEFAULT_SETTINGS)).toEqual({
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      blocksPerLongBreak: 4,
    });
  });
});

describe("local state", () => {
  it("falls back to the default for a missing key", async () => {
    expect(await getLocal("tasks")).toEqual(DEFAULT_LOCAL.tasks);
    expect(await getLocal("timer")).toEqual(DEFAULT_LOCAL.timer);
  });

  it("round-trips a patch", async () => {
    await setLocal({ activeTaskId: "t1", blockingOn: true });
    expect(await getLocal("activeTaskId")).toBe("t1");
    expect(await getLocal("blockingOn")).toBe(true);
  });
});

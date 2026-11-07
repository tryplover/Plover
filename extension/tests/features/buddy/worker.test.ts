import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NUDGE_VISIBLE_MS, showNudge } from "@/features/buddy/worker";
import { DEFAULT_LOCAL, getLocal, setLocal } from "@/shared/storage";

const T0 = 1_700_000_000_000;

describe("showNudge", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the text for the visible window from the given time", async () => {
    await showNudge("hello", T0);
    const t = await getLocal("transient");
    expect(t.nudgeText).toBe("hello");
    expect(t.nudgeUntil).toBe(T0 + NUDGE_VISIBLE_MS);
  });

  it("keeps the other transient fields", async () => {
    await setLocal({
      transient: {
        ...DEFAULT_LOCAL.transient,
        checkInPending: true,
        celebrateUntil: T0 + 5,
      },
    });
    await showNudge("hello", T0);
    const t = await getLocal("transient");
    expect(t.checkInPending).toBe(true);
    expect(t.celebrateUntil).toBe(T0 + 5);
  });

  it("defaults the time to now", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    await showNudge("hello");
    expect((await getLocal("transient")).nudgeUntil).toBe(
      T0 + NUDGE_VISIBLE_MS,
    );
  });
});

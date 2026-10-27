import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerCalendarHandlers } from "@/features/calendar/worker";
import { registerFocusHandlers } from "@/features/focus/worker";
import { reconcile } from "@/worker/reconcile";
import { registerTimerHandlers } from "@/features/timer/worker";
import { setLocal } from "@/shared/storage";

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const fetchMock = vi.fn();

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    Response.json({
      items: [
        {
          id: "a",
          summary: "Stand-up",
          start: { dateTime: new Date(T0 + 20 * MIN).toISOString() },
          end: { dateTime: new Date(T0 + 50 * MIN).toISOString() },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  registerTimerHandlers();
  registerFocusHandlers();
  registerCalendarHandlers();
  await setLocal({
    timer: {
      phase: "work",
      phaseEndsAt: T0 + 20 * MIN,
      blocksCompleted: 0,
      pausedAt: null,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reconcile", () => {
  it("recreates focus-nudge, calendar-refresh and calendar-headsup", async () => {
    await setLocal({
      focus: { on: true, startedAt: T0 - 5 * MIN },
      calendarConnected: true,
    });
    await fakeBrowser.storage.session.set({
      googleToken: { accessToken: "tok", expiresAt: T0 + 60 * MIN },
    });
    await fakeBrowser.alarms.clearAll();

    await reconcile();

    expect((await fakeBrowser.alarms.get("focus-nudge"))?.periodInMinutes).toBe(
      15,
    );
    expect(
      (await fakeBrowser.alarms.get("calendar-refresh"))?.periodInMinutes,
    ).toBe(15);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (await fakeBrowser.alarms.get("calendar-headsup"))?.scheduledTime,
    ).toBe(T0 + 15 * MIN);
    expect((await fakeBrowser.alarms.get("timer-phase"))?.scheduledTime).toBe(
      T0 + 20 * MIN,
    );
  });

  it("recreates nothing extra when focus is off and calendar is disconnected", async () => {
    await fakeBrowser.alarms.clearAll();
    await reconcile();
    const names = (await fakeBrowser.alarms.getAll()).map((a) => a.name);
    expect(names).not.toContain("focus-nudge");
    expect(names).not.toContain("calendar-refresh");
    expect(names).not.toContain("calendar-headsup");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

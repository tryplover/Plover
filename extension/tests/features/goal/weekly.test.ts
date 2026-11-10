import { describe, expect, it } from "vitest";
import { focusedDays, goalProgress, weekStart } from "@/features/goal/weekly";
import type { Session } from "@/shared/types";

const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const sess = (startedAt: number, over: Partial<Session> = {}): Session => ({
  id: String(startedAt),
  taskId: null,
  phase: "work",
  startedAt,
  endedAt: startedAt + 25 * 60_000,
  completed: true,
  ...over,
});

describe("weekStart", () => {
  it("returns local Monday 00:00 for a midweek time", () => {
    expect(weekStart(local(2026, 10, 28, 14, 5))).toBe(local(2026, 10, 26));
  });

  it("treats Sunday 23:30 as part of the week that began the previous Monday", () => {
    expect(weekStart(local(2026, 11, 1, 23, 30))).toBe(local(2026, 10, 26));
  });

  it("starts a new week on Monday 00:10", () => {
    expect(weekStart(local(2026, 11, 2, 0, 10))).toBe(local(2026, 11, 2));
  });

  it("returns Monday itself at 00:00", () => {
    expect(weekStart(local(2026, 10, 26))).toBe(local(2026, 10, 26));
  });
});

describe("focusedDays", () => {
  const now = local(2026, 10, 29, 12);

  it("marks days with a completed work session", () => {
    const days = focusedDays(
      [sess(local(2026, 10, 26, 9)), sess(local(2026, 10, 28, 23, 59))],
      now,
    );
    expect(days).toEqual([true, false, true, false, false, false, false]);
  });

  it("ignores breaks, incomplete sessions and other weeks", () => {
    const days = focusedDays(
      [
        sess(local(2026, 10, 27, 9), { phase: "break" as Session["phase"] }),
        sess(local(2026, 10, 27, 10), { completed: false }),
        sess(local(2026, 10, 25, 23, 30)),
        sess(local(2026, 11, 2, 0, 10)),
      ],
      now,
    );
    expect(days.every((d) => !d)).toBe(true);
  });

  it("splits Sunday 23:30 and Monday 00:10 across weeks", () => {
    const sunday = sess(local(2026, 11, 1, 23, 30));
    const monday = sess(local(2026, 11, 2, 0, 10));
    const thisWeek = focusedDays([sunday, monday], local(2026, 11, 1, 23, 45));
    expect(thisWeek).toEqual([false, false, false, false, false, false, true]);
    const nextWeek = focusedDays([sunday, monday], local(2026, 11, 2, 8));
    expect(nextWeek).toEqual([true, false, false, false, false, false, false]);
  });

  it("uses local calendar days across the DST change", () => {
    const days = focusedDays(
      [sess(local(2026, 11, 1, 0, 30)), sess(local(2026, 11, 1, 23, 30))],
      local(2026, 11, 1, 23, 50),
    );
    expect(days.filter(Boolean)).toHaveLength(1);
    expect(days[6]).toBe(true);
  });
});

describe("goalProgress", () => {
  const now = local(2026, 10, 29, 12);
  const sessions = [sess(local(2026, 10, 26, 9)), sess(local(2026, 10, 27, 9))];

  it("is null when the goal is off", () => {
    expect(goalProgress(sessions, now, null)).toBeNull();
  });

  it("reports progress below the goal", () => {
    expect(goalProgress(sessions, now, 4)).toEqual({
      done: 2,
      goal: 4,
      met: false,
      days: [true, true, false, false, false, false, false],
    });
  });

  it("is met at or above the goal", () => {
    expect(goalProgress(sessions, now, 2)?.met).toBe(true);
    expect(goalProgress(sessions, now, 1)?.met).toBe(true);
  });
});

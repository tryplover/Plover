import { describe, expect, it } from "vitest";
import { formatUntil, freeWindow } from "@/features/calendar/free-window";
import type { CalendarEvent } from "@/shared/types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse("2026-10-26T15:00:00Z");

const ev = (
  id: string,
  start: number,
  end: number,
  allDay = false,
): CalendarEvent => ({ id, title: id, start, end, allDay });

describe("freeWindow", () => {
  it("returns the full horizon when nothing is scheduled", () => {
    expect(freeWindow([], NOW, 3 * HOUR)).toEqual({
      until: null,
      minutes: 180,
    });
  });

  it("returns minutes until the next event within the horizon", () => {
    const e = ev("a", NOW + 45 * MIN + 30_000, NOW + 2 * HOUR);
    expect(freeWindow([e], NOW, 3 * HOUR)).toEqual({
      until: e.start,
      minutes: 45,
    });
  });

  it("ignores events beyond the horizon", () => {
    const e = ev("a", NOW + 4 * HOUR, NOW + 5 * HOUR);
    expect(freeWindow([e], NOW, 3 * HOUR)).toEqual({
      until: null,
      minutes: 180,
    });
  });

  it("counts an event starting exactly at the horizon", () => {
    const e = ev("a", NOW + 3 * HOUR, NOW + 4 * HOUR);
    expect(freeWindow([e], NOW, 3 * HOUR).until).toBe(e.start);
  });

  it("ignores all-day events and past events", () => {
    const events = [
      ev("allday", NOW - HOUR, NOW + 10 * HOUR, true),
      ev("past", NOW - 2 * HOUR, NOW - HOUR),
    ];
    expect(freeWindow(events, NOW, 3 * HOUR)).toEqual({
      until: null,
      minutes: 180,
    });
  });

  it("reports an in-progress event as zero minutes until it ends", () => {
    const e = ev("now", NOW - 10 * MIN, NOW + 20 * MIN);
    expect(freeWindow([e], NOW, 3 * HOUR)).toEqual({
      until: e.end,
      minutes: 0,
    });
  });
});

describe("formatUntil", () => {
  it("formats as a local hour and minute", () => {
    const d = new Date(2026, 9, 26, 11, 0).getTime();
    expect(formatUntil(d)).toBe(
      new Date(d).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
    expect(formatUntil(d)).toMatch(/11/);
  });
});

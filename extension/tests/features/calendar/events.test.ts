import { describe, expect, it } from "vitest";
import {
  conflictDuring,
  nextEvent,
  nextUpcoming,
  parseEvents,
  resolveShorten,
  shortenTarget,
} from "@/features/calendar/events";

const MIN = 60_000;
const T0 = Date.parse("2026-10-26T15:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const timed = (id: string, start: number, end: number, summary?: string) => ({
  id,
  summary,
  status: "confirmed",
  start: { dateTime: iso(start) },
  end: { dateTime: iso(end) },
});

describe("parseEvents", () => {
  it("parses timed events and falls back to a placeholder title", () => {
    const events = parseEvents({
      items: [
        timed("a", T0 + MIN, T0 + 2 * MIN, "Stand-up"),
        timed("b", T0 + 3 * MIN, T0 + 4 * MIN),
      ],
    });
    expect(events).toEqual([
      {
        id: "a",
        title: "Stand-up",
        start: T0 + MIN,
        end: T0 + 2 * MIN,
        allDay: false,
      },
      {
        id: "b",
        title: "(no title)",
        start: T0 + 3 * MIN,
        end: T0 + 4 * MIN,
        allDay: false,
      },
    ]);
  });

  it("skips cancelled events and marks date-only events all-day", () => {
    const events = parseEvents({
      items: [
        { ...timed("x", T0, T0 + MIN, "Gone"), status: "cancelled" },
        {
          id: "d",
          summary: "Holiday",
          start: { date: "2026-10-27" },
          end: { date: "2026-10-28" },
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "d", allDay: true });
  });

  it("tolerates garbage input", () => {
    expect(parseEvents(null)).toEqual([]);
    expect(parseEvents({ items: "nope" })).toEqual([]);
    expect(parseEvents({ items: [{ id: 1 }, { id: "q" }] })).toEqual([]);
  });
});

describe("nextEvent / conflictDuring", () => {
  const allDay = {
    id: "ad",
    title: "Holiday",
    start: T0 - 60 * MIN,
    end: T0 + 600 * MIN,
    allDay: true,
  };
  const ev = (id: string, start: number, end: number) => ({
    id,
    title: id,
    start,
    end,
    allDay: false,
  });

  it("never returns an all-day event", () => {
    expect(nextEvent([allDay], T0)).toBeNull();
    expect(conflictDuring([allDay], T0, T0 + 25 * MIN)).toBeNull();
  });

  it("nextEvent returns the first timed event not yet ended", () => {
    const past = ev("past", T0 - 30 * MIN, T0 - 10 * MIN);
    const running = ev("running", T0 - 5 * MIN, T0 + 5 * MIN);
    const later = ev("later", T0 + 40 * MIN, T0 + 70 * MIN);
    expect(nextEvent([allDay, past, running, later], T0)?.id).toBe("running");
    expect(nextEvent([allDay, past, later], T0)?.id).toBe("later");
    expect(nextEvent([past], T0)).toBeNull();
  });

  it("conflict needs a start strictly inside the window", () => {
    const end = T0 + 25 * MIN;
    expect(conflictDuring([ev("at-end", end, end + MIN)], T0, end)).toBeNull();
    expect(conflictDuring([ev("at-start", T0, end)], T0, end)).toBeNull();
    expect(
      conflictDuring([ev("inside", T0 + 10 * MIN, end + MIN)], T0, end)?.id,
    ).toBe("inside");
  });
});

describe("nextUpcoming / shortenTarget", () => {
  const ev = (id: string, start: number, end: number) => ({
    id,
    title: id,
    start,
    end,
    allDay: false,
  });

  it("nextUpcoming skips in-progress events", () => {
    const running = ev("run", T0 - 5 * MIN, T0 + 5 * MIN);
    const later = ev("later", T0 + 20 * MIN, T0 + 30 * MIN);
    expect(nextUpcoming([running, later], T0)?.id).toBe("later");
    expect(nextUpcoming([running], T0)).toBeNull();
  });

  it("shortenTarget needs at least a 1 minute block", () => {
    expect(shortenTarget(ev("a", T0 + 30 * MIN, T0 + 40 * MIN), T0)).toBe(
      T0 + 29 * MIN,
    );
    expect(shortenTarget(ev("b", T0 + 2 * MIN, T0 + 9 * MIN), T0)).toBe(
      T0 + MIN,
    );
    expect(shortenTarget(ev("c", T0 + 90_000, T0 + 9 * MIN), T0)).toBeNull();
    expect(shortenTarget(ev("d", T0 + 30_000, T0 + 9 * MIN), T0)).toBeNull();
  });
});

describe("resolveShorten", () => {
  const ev = {
    id: "m",
    title: "Meeting",
    start: T0 + 10 * MIN,
    end: T0 + 40 * MIN,
    allDay: false,
  };

  it("returns endBy while there is room", () => {
    expect(resolveShorten(ev, T0)).toEqual({ endBy: T0 + 9 * MIN });
  });

  it("reports tooClose for a click 30 s before the event", () => {
    expect(resolveShorten(ev, ev.start - 30_000)).toEqual({ tooClose: true });
  });
});

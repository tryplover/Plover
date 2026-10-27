import type { CalendarEvent } from "@/lib/types";

interface RawEvent {
  id?: unknown;
  summary?: unknown;
  status?: unknown;
  start?: { dateTime?: unknown; date?: unknown };
  end?: { dateTime?: unknown; date?: unknown };
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

export function parseEvents(json: unknown): CalendarEvent[] {
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: CalendarEvent[] = [];
  for (const raw of items as RawEvent[]) {
    if (!raw || typeof raw.id !== "string" || raw.status === "cancelled") {
      continue;
    }
    const allDay = typeof raw.start?.date === "string";
    const start = toMs(raw.start?.dateTime ?? raw.start?.date);
    const end = toMs(raw.end?.dateTime ?? raw.end?.date);
    if (start === null || end === null) continue;
    out.push({
      id: raw.id,
      title:
        typeof raw.summary === "string" && raw.summary
          ? raw.summary
          : "(no title)",
      start,
      end,
      allDay,
    });
  }
  return out;
}

export function nextEvent(
  events: CalendarEvent[],
  nowMs: number,
): CalendarEvent | null {
  return events.find((e) => !e.allDay && e.end > nowMs) ?? null;
}

export function conflictDuring(
  events: CalendarEvent[],
  startMs: number,
  endMs: number,
): CalendarEvent | null {
  return (
    events.find((e) => !e.allDay && e.start > startMs && e.start < endMs) ??
    null
  );
}

export function nextUpcoming(
  events: CalendarEvent[],
  nowMs: number,
): CalendarEvent | null {
  return events.find((e) => !e.allDay && e.start > nowMs) ?? null;
}

const MIN_MS = 60_000;

export function shortenTarget(
  event: CalendarEvent,
  nowMs: number,
): number | null {
  const endBy = event.start - MIN_MS;
  return endBy - nowMs >= MIN_MS ? endBy : null;
}

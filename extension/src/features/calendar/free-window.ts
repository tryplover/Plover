import type { CalendarEvent } from "@/shared/types";
import { nextEvent } from "./events";

const MIN_MS = 60_000;

export function freeWindow(
  events: CalendarEvent[],
  now: number,
  horizonMs: number,
): { until: number | null; minutes: number } {
  const next = nextEvent(events, now);
  if (next && next.start <= now) return { until: next.end, minutes: 0 };
  if (next && next.start - now <= horizonMs) {
    return {
      until: next.start,
      minutes: Math.floor((next.start - now) / MIN_MS),
    };
  }
  return { until: null, minutes: Math.floor(horizonMs / MIN_MS) };
}

export function formatUntil(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

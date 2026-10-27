import { nextEvent } from "@/lib/calendar/events";
import type { CalendarEvent } from "@/lib/types";

export function CalendarNext({
  events,
  connected,
  now,
}: {
  events: CalendarEvent[];
  connected: boolean;
  now: number;
}) {
  const next = connected ? nextEvent(events, now) : null;
  if (!next) return null;
  const mins = Math.ceil((next.start - now) / 60_000);
  return (
    <p className="plover-calendar">
      {next.title} {mins <= 0 ? "now" : `in ${mins} min`}
    </p>
  );
}

export function ConflictOffer({
  event,
  onShorten,
  onAnyway,
}: {
  event: CalendarEvent;
  onShorten: () => void;
  onAnyway: () => void;
}) {
  return (
    <div className="plover-conflict" role="alert">
      <p>{event.title} starts during your block.</p>
      <div className="plover-row">
        <button type="button" onClick={onShorten}>
          Shorten to end before {event.title}
        </button>
        <button type="button" onClick={onAnyway}>
          Start anyway
        </button>
      </div>
    </div>
  );
}

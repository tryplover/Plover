import { nextEvent, shortenTarget } from "@/lib/calendar/events";
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
  now,
  onShorten,
  onAnyway,
}: {
  event: CalendarEvent;
  now: number;
  onShorten: (endBy: number) => void;
  onAnyway: () => void;
}) {
  return (
    <div className="plover-conflict" role="alert">
      <p>{event.title} starts during your block.</p>
      <div className="plover-row">
        {shortenTarget(event, now) !== null && (
          <button
            type="button"
            onClick={() => onShorten(shortenTarget(event, now) as number)}
          >
            Shorten to end before {event.title}
          </button>
        )}
        <button type="button" onClick={onAnyway}>
          Start anyway
        </button>
      </div>
    </div>
  );
}

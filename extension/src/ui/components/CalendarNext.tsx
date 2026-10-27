import { useState } from "react";
import {
  nextEvent,
  resolveShorten,
  shortenTarget,
} from "@/features/calendar/events";
import type { CalendarEvent } from "@/shared/types";

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
  const [tooClose, setTooClose] = useState(false);
  const canShorten = !tooClose && shortenTarget(event, now) !== null;

  function shorten() {
    const r = resolveShorten(event, Date.now());
    if ("endBy" in r) onShorten(r.endBy);
    else setTooClose(true);
  }

  return (
    <div className="plover-conflict" role="alert">
      <p>{event.title} starts during your block.</p>
      {!canShorten && (tooClose || shortenTarget(event, now) === null) && (
        <p>Too close to {event.title} to shorten.</p>
      )}
      <div className="plover-row">
        {canShorten && (
          <button type="button" onClick={shorten}>
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

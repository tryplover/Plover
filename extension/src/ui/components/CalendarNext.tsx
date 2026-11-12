import { useEffect, useRef, useState } from "react";
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
    <p className="plover-chip">
      {next.title} {mins <= 0 ? "now" : `in ${mins} min`}
    </p>
  );
}

export function ConflictOffer({
  event,
  now,
  onShorten,
  onAnyway,
  takeFocus = false,
}: {
  event: CalendarEvent;
  now: number;
  onShorten: (endBy: number) => void;
  onAnyway: () => void;
  takeFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooClose, setTooClose] = useState(false);
  const canShorten = !tooClose && shortenTarget(event, now) !== null;

  useEffect(() => {
    if (!takeFocus) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "auto" });
    el.querySelector("button")?.focus({ preventScroll: true });
  }, [takeFocus]);

  function shorten() {
    const r = resolveShorten(event, Date.now());
    if ("endBy" in r) onShorten(r.endBy);
    else setTooClose(true);
  }

  return (
    <div
      ref={ref}
      className="plover-conflict"
      role="alert"
      aria-label={`Calendar conflict with ${event.title}`}
    >
      <p>{event.title} starts during your block.</p>
      {!canShorten && (tooClose || shortenTarget(event, now) === null) && (
        <p>Too close to {event.title} to shorten.</p>
      )}
      <div className="plover-row">
        {canShorten && (
          <button
            type="button"
            className="plover-btn-compact"
            onClick={shorten}
          >
            Shorten to end before {event.title}
          </button>
        )}
        <button type="button" className="plover-btn-text" onClick={onAnyway}>
          Start anyway
        </button>
      </div>
    </div>
  );
}

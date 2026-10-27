import { useState } from "react";
import { browser } from "wxt/browser";
import { conflictDuring } from "@/lib/calendar/events";
import { deriveBuddyState } from "@/lib/buddy-state";
import { sendCommand } from "@/lib/messages";
import type { CalendarEvent } from "@/lib/types";
import { CalendarNext, ConflictOffer } from "./CalendarNext";
import { CheckIn } from "./CheckIn";
import { SignIn } from "./SignIn";
import { TaskBreakdown } from "./TaskBreakdown";
import { TimerControls } from "./TimerControls";
import { useExtensionState, type ExtensionState } from "./useExtensionState";
import "./Panel.css";

export function Panel({
  surface,
  state,
}: {
  surface: "popup" | "buddy";
  state?: ExtensionState;
}) {
  const own = useExtensionState(
    state ? "none" : surface === "buddy" ? "port" : "storage",
  );
  const { local, settings, now, ready } = state ?? own;
  const [reauth, setReauth] = useState(false);
  const [focusConflict, setFocusConflict] = useState<CalendarEvent | null>(
    null,
  );

  if (!ready)
    return <div className={`plover-panel plover-surface-${surface}`} />;

  const idle = local.timer.phase === "idle";
  const activeTask = local.tasks.find((t) => t.id === local.activeTaskId);
  const buddy = deriveBuddyState(local, now);

  function toggleFocus() {
    if (!local.focus.on && idle) {
      const clash = conflictDuring(
        local.calendar.events,
        Date.now(),
        Date.now() + settings.workMinutes * 60_000,
      );
      if (clash) {
        setFocusConflict(clash);
        return;
      }
    }
    setFocusConflict(null);
    void sendCommand({ type: "focus/set", on: !local.focus.on });
  }

  function startFocus(endBy?: number) {
    setFocusConflict(null);
    void sendCommand({ type: "focus/set", on: true, endBy });
  }

  const focusSwitch = (
    <>
      <label className="plover-focus">
        <input
          type="checkbox"
          checked={local.focus.on}
          onChange={toggleFocus}
        />
        Focus mode
      </label>
      {focusConflict && (
        <ConflictOffer
          event={focusConflict}
          now={now}
          onShorten={(endBy) => startFocus(endBy)}
          onAnyway={() => startFocus()}
        />
      )}
    </>
  );

  const showSignIn = local.needsSignIn && idle;
  const body = (
    <>
      {showSignIn && <SignIn />}
      {local.needsSignIn && !idle && (
        <div className="plover-banner">
          <button type="button" onClick={() => setReauth(!reauth)}>
            Sign in again
          </button>
          {reauth && <SignIn />}
        </div>
      )}
      <CalendarNext
        events={local.calendar.events}
        connected={local.calendarConnected}
        now={now}
      />
      {idle ? (
        <div hidden={showSignIn}>
          <TaskBreakdown
            events={local.calendar.events}
            workMinutes={settings.workMinutes}
            now={now}
          />
          {focusSwitch}
        </div>
      ) : (
        <>
          {activeTask && <p className="plover-task">{activeTask.title}</p>}
          <TimerControls timer={local.timer} now={now} />
          {focusSwitch}
          {local.transient.checkInPending && <CheckIn task={activeTask} />}
        </>
      )}
    </>
  );

  return (
    <div
      className={`plover-panel plover-surface-${surface}`}
      data-buddy={buddy}
    >
      {body}
      <button
        type="button"
        className="plover-link"
        onClick={() => void browser.runtime.openOptionsPage()}
      >
        Settings
      </button>
    </div>
  );
}

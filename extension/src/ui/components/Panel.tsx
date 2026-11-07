import { useState } from "react";
import { browser } from "wxt/browser";
import { conflictDuring } from "@/features/calendar/events";
import { deriveBuddyState } from "@/features/buddy/buddy-state";
import { findActiveTask } from "@/features/tasks/active-step";
import type { TimerPhase } from "@/features/timer/types";
import { sendCommand } from "@/shared/messages";
import type { CalendarEvent } from "@/shared/types";
import { ActiveSteps } from "@/ui/components/ActiveSteps";
import { CalendarNext, ConflictOffer } from "@/ui/components/CalendarNext";
import { Buddy } from "@/ui/components/Buddy";
import { CheckIn } from "@/ui/components/CheckIn";
import { SavedTasks } from "@/ui/components/SavedTasks";
import { SiteAccess } from "@/ui/components/SiteAccess";
import { SignIn } from "@/ui/components/SignIn";
import { TaskBreakdown } from "@/ui/components/TaskBreakdown";
import { TimerControls } from "@/ui/components/TimerControls";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import "./Panel.css";

function eyebrowFor(phase: TimerPhase, focusOn: boolean): string {
  switch (phase) {
    case "idle":
      return "Plover · Today";
    case "work":
      return focusOn ? "Focus · Work block" : "Work block";
    default:
      return "Break";
  }
}

export function Panel({ surface }: { surface: "popup" | "buddy" }) {
  const { local, settings, now, ready } = useExtensionState();
  const [reauth, setReauth] = useState(false);
  const [focusConflict, setFocusConflict] = useState<CalendarEvent | null>(
    null,
  );

  if (!ready)
    return <div className={`plover-panel plover-surface-${surface}`} />;

  const idle = local.timer.phase === "idle";
  const activeTask = findActiveTask(local.tasks, local.activeTaskId);
  const checkInTask = findActiveTask(
    local.tasks,
    local.transient.checkInTaskId ?? local.activeTaskId,
  );
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
      <label className="plover-toggle">
        Focus mode
        <input
          type="checkbox"
          checked={local.focus.on}
          onChange={toggleFocus}
        />
      </label>
      {!local.focus.on && (
        <label className="plover-toggle">
          Block sites now
          <input
            type="checkbox"
            checked={local.blockingOn}
            onChange={() =>
              void sendCommand({ type: "blocking/set", on: !local.blockingOn })
            }
          />
        </label>
      )}
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
  const nudge =
    local.transient.nudgeUntil > now ? local.transient.nudgeText : null;
  const eyebrow = eyebrowFor(local.timer.phase, local.focus.on);
  const body = (
    <>
      {nudge && <p className="plover-nudge">{nudge}</p>}
      {local.transient.checkInPending && <CheckIn task={checkInTask} />}
      {showSignIn && <SignIn />}
      {local.needsSignIn && !idle && (
        <div className="plover-banner">
          <button
            type="button"
            className="plover-btn-text"
            onClick={() => setReauth(!reauth)}
          >
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
        <div className="plover-idle" hidden={showSignIn}>
          <TaskBreakdown
            events={local.calendar.events}
            workMinutes={settings.workMinutes}
            now={now}
          />
          <SavedTasks
            tasks={local.tasks}
            activeTaskId={local.activeTaskId}
            events={local.calendar.events}
            workMinutes={settings.workMinutes}
            blocksPerLongBreak={settings.blocksPerLongBreak}
            now={now}
          />
          {focusSwitch}
        </div>
      ) : (
        <>
          {activeTask && <p className="plover-task">{activeTask.title}</p>}
          {activeTask && <ActiveSteps task={activeTask} />}
          <TimerControls
            timer={local.timer}
            now={now}
            canPark={activeTask !== undefined}
            buddy={
              surface === "popup" ? (
                <div className="plover-buddy-small">
                  <Buddy state={buddy} />
                </div>
              ) : undefined
            }
          />
          {focusSwitch}
        </>
      )}
    </>
  );

  return (
    <div
      className={`plover-panel plover-surface-${surface}`}
      data-buddy={buddy}
    >
      <p className="plover-eyebrow">{eyebrow}</p>
      {surface === "popup" && <SiteAccess />}
      {surface === "popup" && idle && (
        <div className="plover-buddy-large">
          <Buddy state={buddy} />
        </div>
      )}
      {body}
      <button
        type="button"
        className="plover-btn-text plover-link"
        onClick={() => void browser.runtime.openOptionsPage()}
      >
        Settings
      </button>
    </div>
  );
}

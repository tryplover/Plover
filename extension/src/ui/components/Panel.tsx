import { useState } from "react";
import { browser } from "wxt/browser";
import { conflictDuring } from "@/features/calendar/events";
import { deriveBuddyState } from "@/features/buddy/buddy-state";
import { findActiveTask, firstOpenStep } from "@/features/tasks/active-step";
import { sendCommand } from "@/shared/messages";
import type { CalendarEvent } from "@/shared/types";
import { CalendarNext, ConflictOffer } from "@/ui/components/CalendarNext";
import { CheckIn } from "@/ui/components/CheckIn";
import { SiteAccess } from "@/ui/components/SiteAccess";
import { SignIn } from "@/ui/components/SignIn";
import { TaskBreakdown } from "@/ui/components/TaskBreakdown";
import { TimerControls } from "@/ui/components/TimerControls";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import "./Panel.css";

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
      {!local.focus.on && (
        <label className="plover-focus">
          <input
            type="checkbox"
            checked={local.blockingOn}
            onChange={() =>
              void sendCommand({ type: "blocking/set", on: !local.blockingOn })
            }
          />
          Block sites now
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
  const currentStep = firstOpenStep(activeTask);
  const body = (
    <>
      {nudge && <p className="plover-nudge">{nudge}</p>}
      {local.transient.checkInPending && <CheckIn task={activeTask} />}
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
          {activeTask && activeTask.steps.length > 0 && (
            <ul className="plover-steps">
              {activeTask.steps.map((s) => (
                <li
                  key={s.id}
                  className={
                    s.id === currentStep?.id ? "plover-step-current" : undefined
                  }
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() =>
                        void sendCommand({
                          type: "step/toggle",
                          taskId: activeTask.id,
                          stepId: s.id,
                        })
                      }
                    />
                    {s.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <TimerControls timer={local.timer} now={now} />
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
      {surface === "popup" && <SiteAccess />}
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

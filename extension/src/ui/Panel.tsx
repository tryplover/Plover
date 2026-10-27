import { useState } from "react";
import { browser } from "wxt/browser";
import { deriveBuddyState } from "@/lib/buddy-state";
import { sendCommand } from "@/lib/messages";
import { CheckIn } from "./CheckIn";
import { SignIn } from "./SignIn";
import { TaskBreakdown } from "./TaskBreakdown";
import { TimerControls } from "./TimerControls";
import { useExtensionState } from "./useExtensionState";
import "./Panel.css";

export function Panel({ surface }: { surface: "popup" | "buddy" }) {
  const { local, now, ready } = useExtensionState();
  const [reauth, setReauth] = useState(false);

  if (!ready) return <div className={`plover-panel plover-${surface}`} />;

  const idle = local.timer.phase === "idle";
  const activeTask = local.tasks.find((t) => t.id === local.activeTaskId);
  const buddy = deriveBuddyState(local, now);

  const focusSwitch = (
    <label className="plover-focus">
      <input
        type="checkbox"
        checked={local.focus.on}
        onChange={() =>
          void sendCommand({ type: "focus/set", on: !local.focus.on })
        }
      />
      Focus mode
    </label>
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
      {idle ? (
        <div hidden={showSignIn}>
          <TaskBreakdown />
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
    <div className={`plover-panel plover-${surface}`} data-buddy={buddy}>
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

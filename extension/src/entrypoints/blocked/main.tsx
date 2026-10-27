import { createRoot } from "react-dom/client";
import { sendCommand } from "@/lib/messages";
import { remainingSeconds } from "@/lib/timer/machine";
import { formatClock } from "@/ui/TimerControls";
import { Buddy } from "@/ui/Buddy";
import { deriveBuddyState } from "@/lib/buddy-state";
import { useExtensionState } from "@/ui/useExtensionState";
import "./blocked.css";

function Blocked() {
  const { local, now, ready } = useExtensionState();
  if (!ready) return null;
  const running = local.timer.phase !== "idle";
  if (!local.blockingOn) {
    return (
      <main className="blocked">
        <Buddy state={deriveBuddyState(local, now)} />
        <h1>Focus is over — you&apos;re free to go.</h1>
      </main>
    );
  }
  return (
    <main className="blocked">
      <Buddy state={deriveBuddyState(local, now)} />
      <h1>This one&apos;s blocked until your focus block ends.</h1>
      {running && (
        <p className="blocked-clock">
          {formatClock(remainingSeconds(local.timer, now))}
        </p>
      )}
      <button
        type="button"
        onClick={() => void sendCommand({ type: "focus/set", on: false })}
      >
        End focus early
      </button>
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Blocked />);
}

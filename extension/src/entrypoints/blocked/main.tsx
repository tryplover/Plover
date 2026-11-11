import { createRoot } from "react-dom/client";
import { sendCommand } from "@/shared/messages";
import { remainingSeconds } from "@/features/timer/machine";
import { formatClock } from "@/ui/components/TimerControls";
import { blockedCopy } from "@/features/blocking/blocked-copy";
import { Buddy } from "@/ui/components/Buddy";
import { deriveBuddyState } from "@/features/buddy/buddy-state";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./blocked.css";

function Blocked() {
  const { local, now, ready } = useExtensionState();
  if (!ready) return null;
  if (!local.blockingOn) {
    return (
      <main className="blocked">
        <Buddy state={deriveBuddyState(local, now)} />
        <h1>Focus is over — you&apos;re free to go.</h1>
      </main>
    );
  }
  const copy = blockedCopy(local);
  return (
    <main className="blocked">
      <Buddy state={deriveBuddyState(local, now)} />
      <h1>{copy.heading}</h1>
      {copy.countdownTo !== null && (
        <p className="blocked-clock">
          <span className="blocked-clock-label">Next break in</span>
          {formatClock(remainingSeconds(local.timer, now))}
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          void sendCommand(
            copy.action === "endFocus"
              ? { type: "focus/set", on: false }
              : { type: "blocking/set", on: false },
          )
        }
      >
        {copy.action === "endFocus" ? "End focus early" : "Turn blocking off"}
      </button>
    </main>
  );
}

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Blocked />);
}

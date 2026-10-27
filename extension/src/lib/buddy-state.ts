import type { BuddyAnimationState, LocalState } from "./types";

export const STATE_PORT = "plover-state";

export interface BuddySnapshot {
  buddyState: BuddyAnimationState;
  nudgeText: string | null;
  checkInPending: boolean;
}

export function deriveBuddyState(
  s: Pick<LocalState, "timer" | "focus" | "transient">,
  nowMs: number,
): BuddyAnimationState {
  if (s.transient.celebrateUntil > nowMs) return "celebrating";
  if (s.transient.nudgeUntil > nowMs || s.transient.checkInPending)
    return "nudging";
  const { phase } = s.timer;
  if (phase === "work") return s.focus.on ? "focus" : "working";
  if (phase === "shortBreak" || phase === "longBreak") return "break";
  return "idle";
}

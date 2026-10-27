import type { BuddyAnimationState, LocalState } from "./types";

export function deriveBuddyState(
  s: Pick<LocalState, "timer" | "focus" | "transient">,
  nowMs: number,
): BuddyAnimationState {
  if (s.transient.celebrateUntil > nowMs) return "celebrating";
  if (s.transient.nudgeUntil > nowMs) return "nudging";
  const { phase } = s.timer;
  if (phase === "work") return s.focus.on ? "focus" : "working";
  if (phase === "shortBreak" || phase === "longBreak") return "break";
  return "idle";
}

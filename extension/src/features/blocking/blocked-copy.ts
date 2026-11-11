import type { LocalState } from "@/shared/types";

export interface BlockedCopy {
  heading: string;
  countdownTo: number | null;
  action: "endFocus" | "stopBlocking";
}

export function blockedCopy(local: LocalState): BlockedCopy {
  if (!local.focus.on) {
    return {
      heading: "Blocked until you turn blocking off",
      countdownTo: null,
      action: "stopBlocking",
    };
  }
  const { phase, pausedAt, phaseEndsAt } = local.timer;
  if (phase === "idle" || pausedAt !== null) {
    return {
      heading: "Blocked while focus mode is on",
      countdownTo: null,
      action: "endFocus",
    };
  }
  if (phase === "work") {
    return {
      heading: "Blocked while focus mode is on",
      countdownTo: phaseEndsAt,
      action: "endFocus",
    };
  }
  return {
    heading: "Still blocked: focus mode is on",
    countdownTo: null,
    action: "endFocus",
  };
}

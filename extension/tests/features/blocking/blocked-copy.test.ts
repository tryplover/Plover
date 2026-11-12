import { describe, expect, it } from "vitest";
import { blockedCopy } from "@/features/blocking/blocked-copy";
import { DEFAULT_LOCAL } from "@/shared/storage";
import type { LocalState } from "@/shared/types";
import type { TimerState } from "@/features/timer/types";

function state(focusOn: boolean, timer: Partial<TimerState>): LocalState {
  return {
    ...DEFAULT_LOCAL,
    blockingOn: true,
    focus: { on: focusOn, startedAt: focusOn ? 1 : null },
    timer: { ...DEFAULT_LOCAL.timer, ...timer },
  };
}

describe("blockedCopy", () => {
  it("counts down to the break during a work block", () => {
    expect(
      blockedCopy(state(true, { phase: "work", phaseEndsAt: 5000 })),
    ).toEqual({
      heading: "Blocked while focus mode is on",
      countdownTo: 5000,
      action: "endFocus",
    });
  });

  it.each(["shortBreak", "longBreak"] as const)(
    "says blocking continues during a %s",
    (phase) => {
      expect(blockedCopy(state(true, { phase, phaseEndsAt: 5000 }))).toEqual({
        heading: "Still blocked: focus mode is on",
        countdownTo: null,
        action: "endFocus",
      });
    },
  );

  it("has no countdown while the timer is paused", () => {
    expect(
      blockedCopy(
        state(true, { phase: "work", phaseEndsAt: 5000, pausedAt: 2000 }),
      ),
    ).toEqual({
      heading: "Blocked while focus mode is on",
      countdownTo: null,
      action: "endFocus",
    });
  });

  it("has no countdown while the timer is idle", () => {
    expect(blockedCopy(state(true, { phase: "idle" }))).toEqual({
      heading: "Blocked while focus mode is on",
      countdownTo: null,
      action: "endFocus",
    });
  });

  it("offers to turn blocking off when it was turned on by hand", () => {
    expect(
      blockedCopy(state(false, { phase: "work", phaseEndsAt: 5000 })),
    ).toEqual({
      heading: "Blocked until you turn blocking off",
      countdownTo: null,
      action: "stopBlocking",
    });
  });
});

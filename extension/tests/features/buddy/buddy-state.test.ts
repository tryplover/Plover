import { describe, expect, it } from "vitest";
import { deriveBuddyState } from "@/features/buddy/buddy-state";
import { IDLE_TIMER } from "@/features/timer/machine";
import type { TimerState } from "@/features/timer/types";

const NOW = 1_000_000;
const running = (
  phase: TimerState["phase"],
  pausedAt: number | null = null,
): TimerState => ({
  phase,
  phaseEndsAt: NOW + 60_000,
  blocksCompleted: 0,
  pausedAt,
});
const calm = {
  checkInPending: false,
  nudgeText: null,
  nudgeUntil: 0,
  celebrateUntil: 0,
};
const off = { on: false, startedAt: null };
const on = { on: true, startedAt: NOW };

describe("deriveBuddyState", () => {
  it("celebrating has the highest priority", () => {
    const transient = { ...calm, celebrateUntil: NOW + 1, nudgeUntil: NOW + 1 };
    expect(
      deriveBuddyState({ timer: running("work"), focus: on, transient }, NOW),
    ).toBe("celebrating");
  });

  it("nudging beats the timer state", () => {
    const transient = { ...calm, nudgeUntil: NOW + 1 };
    expect(
      deriveBuddyState({ timer: running("work"), focus: on, transient }, NOW),
    ).toBe("nudging");
  });

  it("a pending check-in shows as nudging over the timer state", () => {
    const transient = { ...calm, checkInPending: true };
    expect(
      deriveBuddyState({ timer: running("work"), focus: on, transient }, NOW),
    ).toBe("nudging");
    expect(
      deriveBuddyState({ timer: IDLE_TIMER, focus: off, transient }, NOW),
    ).toBe("nudging");
  });

  it("celebrating beats a pending check-in", () => {
    const transient = {
      ...calm,
      checkInPending: true,
      celebrateUntil: NOW + 1,
    };
    expect(
      deriveBuddyState({ timer: running("work"), focus: on, transient }, NOW),
    ).toBe("celebrating");
  });

  it("ignores expired celebrate and nudge windows", () => {
    const transient = { ...calm, celebrateUntil: NOW, nudgeUntil: NOW - 1 };
    expect(
      deriveBuddyState({ timer: IDLE_TIMER, focus: off, transient }, NOW),
    ).toBe("idle");
  });

  it("focus while working", () => {
    expect(
      deriveBuddyState(
        { timer: running("work"), focus: on, transient: calm },
        NOW,
      ),
    ).toBe("focus");
  });

  it("working, including paused", () => {
    expect(
      deriveBuddyState(
        { timer: running("work"), focus: off, transient: calm },
        NOW,
      ),
    ).toBe("working");
    expect(
      deriveBuddyState(
        { timer: running("work", NOW - 5), focus: off, transient: calm },
        NOW,
      ),
    ).toBe("working");
  });

  it("break phases", () => {
    for (const phase of ["shortBreak", "longBreak"] as const) {
      expect(
        deriveBuddyState(
          { timer: running(phase), focus: on, transient: calm },
          NOW,
        ),
      ).toBe("break");
    }
  });
});

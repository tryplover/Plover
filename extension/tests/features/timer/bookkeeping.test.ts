import { describe, expect, it } from "vitest";
import { bookkeep, type BookkeepingInput } from "@/features/timer/bookkeeping";
import type { TimerState, TimerTransition } from "@/features/timer/types";
import type { Session, Transient } from "@/shared/types";

const NOW = 1_700_000_000_000;
const TRANSIENT: Transient = {
  checkInPending: false,
  checkInTaskId: null,
  nudgeText: "hi",
  nudgeUntil: 42,
  celebrateUntil: 7,
};
const SESSION: Session = {
  id: "old",
  taskId: "t0",
  phase: "work",
  startedAt: 1,
  endedAt: 2,
  completed: true,
};
const newId = () => "new-id";

function stored(overrides: Partial<BookkeepingInput> = {}) {
  return {
    phaseStartedAt: NOW - 1_000,
    activeTaskId: "task-1",
    sessions: [SESSION],
    transient: TRANSIENT,
    ...overrides,
  };
}

const workRunning: TimerState = {
  phase: "work",
  phaseEndsAt: NOW + 60_000,
  blocksCompleted: 0,
  pausedAt: null,
};

describe("bookkeep", () => {
  it("records a completed work session and sets check-in pending on block completion", () => {
    const prev: TimerState = { ...workRunning, phaseEndsAt: NOW - 500 };
    const t: TimerTransition = {
      state: {
        phase: "shortBreak",
        phaseEndsAt: NOW + 300_000,
        blocksCompleted: 1,
        pausedAt: null,
      },
      events: [
        { type: "work-block-completed", blocksCompleted: 1 },
        {
          type: "phase-started",
          phase: "shortBreak",
          plannedSeconds: 300,
          blocksCompleted: 1,
        },
      ],
    };

    const out = bookkeep(prev, t, stored(), NOW, newId);

    expect(out.sessions).toEqual([
      SESSION,
      {
        id: "new-id",
        taskId: "task-1",
        phase: "work",
        startedAt: NOW - 1_000,
        endedAt: NOW - 500,
        completed: true,
      },
    ]);
    expect(out.transient).toEqual({
      ...TRANSIENT,
      checkInPending: true,
      checkInTaskId: "task-1",
    });
    expect(out.phaseStartedAt).toBe(NOW);
  });

  it("records an early stop while paused at pausedAt and clears check-in", () => {
    const prev: TimerState = { ...workRunning, pausedAt: NOW - 2_000 };
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [{ type: "stopped", blocksCompleted: 0 }],
    };

    const out = bookkeep(
      prev,
      t,
      stored({ transient: { ...TRANSIENT, checkInPending: true } }),
      NOW,
      newId,
    );

    expect(out.sessions.at(-1)).toEqual({
      id: "new-id",
      taskId: "task-1",
      phase: "work",
      startedAt: NOW - 1_000,
      endedAt: NOW - 2_000,
      completed: false,
    });
    expect(out.transient.checkInPending).toBe(false);
    expect(out.phaseStartedAt).toBeNull();
  });

  it("ends an unpaused early stop at nowMs", () => {
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [{ type: "stopped", blocksCompleted: 0 }],
    };

    const out = bookkeep(workRunning, t, stored(), NOW, newId);

    expect(out.sessions.at(-1)?.endedAt).toBe(NOW);
    expect(out.sessions.at(-1)?.completed).toBe(false);
  });

  it("starts the work startedAt at nowMs when no phase start was stored", () => {
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [{ type: "stopped", blocksCompleted: 0 }],
    };

    const out = bookkeep(
      workRunning,
      t,
      stored({ phaseStartedAt: null }),
      NOW,
      newId,
    );

    expect(out.sessions.at(-1)?.startedAt).toBe(NOW);
  });

  it("sets phaseStartedAt to nowMs on a phase-started event", () => {
    const prev: TimerState = {
      phase: "shortBreak",
      phaseEndsAt: NOW,
      blocksCompleted: 1,
      pausedAt: null,
    };
    const t: TimerTransition = {
      state: workRunning,
      events: [
        {
          type: "phase-started",
          phase: "work",
          plannedSeconds: 1500,
          blocksCompleted: 1,
        },
      ],
    };

    const out = bookkeep(prev, t, stored(), NOW, newId);

    expect(out.phaseStartedAt).toBe(NOW);
    expect(out.sessions).toEqual([SESSION]);
    expect(out.transient).toBe(TRANSIENT);
  });

  it("keeps phaseStartedAt when no phase-started event fires", () => {
    const t: TimerTransition = {
      state: { ...workRunning, pausedAt: NOW },
      events: [],
    };

    const out = bookkeep(workRunning, t, stored(), NOW, newId);

    expect(out.phaseStartedAt).toBe(NOW - 1_000);
    expect(out.sessions).toEqual([SESSION]);
  });

  it("clears phaseStartedAt when going idle", () => {
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [],
    };

    const out = bookkeep(
      {
        phase: "shortBreak",
        phaseEndsAt: NOW,
        blocksCompleted: 1,
        pausedAt: null,
      },
      t,
      stored(),
      NOW,
      newId,
    );

    expect(out.phaseStartedAt).toBeNull();
    expect(out.sessions).toEqual([SESSION]);
  });

  it("does not record a session when the previous phase was not work", () => {
    const prev: TimerState = {
      phase: "shortBreak",
      phaseEndsAt: NOW,
      blocksCompleted: 1,
      pausedAt: null,
    };
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 1,
        pausedAt: null,
      },
      events: [{ type: "stopped", blocksCompleted: 1 }],
    };

    const out = bookkeep(prev, t, stored(), NOW, newId);

    expect(out.sessions).toEqual([SESSION]);
    expect(out.transient.checkInPending).toBe(false);
  });

  it("does not record a session while work continues", () => {
    const t: TimerTransition = { state: workRunning, events: [] };

    const out = bookkeep(workRunning, t, stored(), NOW, newId);

    expect(out.sessions).toEqual([SESSION]);
    expect(out.transient).toBe(TRANSIENT);
  });

  it("does not mutate the stored sessions array", () => {
    const sessions = [SESSION];
    const t: TimerTransition = {
      state: {
        phase: "idle",
        phaseEndsAt: 0,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [{ type: "stopped", blocksCompleted: 0 }],
    };

    bookkeep(workRunning, t, stored({ sessions }), NOW, newId);

    expect(sessions).toEqual([SESSION]);
  });
});

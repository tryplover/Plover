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
    activeTaskTitle: "Write report",
    cycleId: "cycle-1" as string | null,
    phasePausedMs: 0,
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
  it("drops a zero-length phase that was cut short, e.g. Stop right after a block ended", () => {
    const breakJustStarted: TimerState = {
      phase: "shortBreak",
      phaseEndsAt: NOW + 300_000,
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

    const out = bookkeep(
      breakJustStarted,
      t,
      stored({ phaseStartedAt: NOW }),
      NOW,
      newId,
    );

    expect(out.sessions).toEqual([SESSION]);
  });
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
        cycleId: "cycle-1",
        pausedMs: 0,
        taskTitle: "Write report",
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
      stored({
        phaseStartedAt: NOW - 60_000,
        transient: { ...TRANSIENT, checkInPending: true },
      }),
      NOW,
      newId,
    );

    expect(out.sessions.at(-1)).toEqual({
      id: "new-id",
      taskId: "task-1",
      phase: "work",
      startedAt: NOW - 60_000,
      endedAt: NOW - 2_000,
      completed: false,
      cycleId: "cycle-1",
      pausedMs: 0,
      taskTitle: "Write report",
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
    expect(out.sessions).toEqual([
      SESSION,
      {
        id: "new-id",
        taskId: "task-1",
        phase: "shortBreak",
        startedAt: NOW - 1_000,
        endedAt: NOW,
        completed: true,
        cycleId: "cycle-1",
        pausedMs: 0,
        taskTitle: "Write report",
      },
    ]);
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
    expect(out.sessions.at(-1)?.phase).toBe("shortBreak");
    expect(out.sessions.at(-1)?.completed).toBe(false);
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

  const idle: TimerState = {
    phase: "idle",
    phaseEndsAt: 0,
    blocksCompleted: 0,
    pausedAt: null,
  };
  const startedWork: TimerTransition = {
    state: workRunning,
    events: [
      {
        type: "phase-started",
        phase: "work",
        plannedSeconds: 1500,
        blocksCompleted: 0,
      },
    ],
  };

  it("records a stopped break as not completed", () => {
    const prev: TimerState = {
      phase: "shortBreak",
      phaseEndsAt: NOW + 60_000,
      blocksCompleted: 1,
      pausedAt: null,
    };
    const t: TimerTransition = {
      state: idle,
      events: [{ type: "stopped", blocksCompleted: 1 }],
    };

    const out = bookkeep(prev, t, stored(), NOW, newId);

    expect(out.sessions.at(-1)).toMatchObject({
      phase: "shortBreak",
      endedAt: NOW,
      completed: false,
    });
    expect(out.sessions.at(-1)?.skipped).toBeUndefined();
  });

  it("marks a skipped work phase and break as skipped", () => {
    const toBreak: TimerTransition = {
      state: {
        phase: "shortBreak",
        phaseEndsAt: NOW + 300_000,
        blocksCompleted: 0,
        pausedAt: null,
      },
      events: [
        {
          type: "phase-started",
          phase: "shortBreak",
          plannedSeconds: 300,
          blocksCompleted: 0,
        },
      ],
    };
    const skippedWork = bookkeep(
      workRunning,
      toBreak,
      stored(),
      NOW,
      newId,
      "skip",
    );
    expect(skippedWork.sessions.at(-1)).toMatchObject({
      phase: "work",
      completed: false,
      skipped: true,
      endedAt: NOW,
    });
    expect(skippedWork.transient.checkInPending).toBe(false);

    const skippedBreak = bookkeep(
      toBreak.state,
      startedWork,
      stored(),
      NOW,
      newId,
      "skip",
    );
    expect(skippedBreak.sessions.at(-1)).toMatchObject({
      phase: "shortBreak",
      completed: false,
      skipped: true,
    });
  });

  it("starts a cycle when leaving idle and ends it on idle", () => {
    const started = bookkeep(
      idle,
      startedWork,
      stored({ cycleId: null }),
      NOW,
      newId,
    );
    expect(started.cycleId).toBe("new-id");
    expect(started.sessions).toEqual([SESSION]);

    const stop: TimerTransition = {
      state: idle,
      events: [{ type: "stopped", blocksCompleted: 0 }],
    };
    expect(
      bookkeep(workRunning, stop, stored(), NOW, newId).cycleId,
    ).toBeNull();

    const next: TimerTransition = {
      state: { ...workRunning, phase: "shortBreak" },
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
    expect(bookkeep(workRunning, next, stored(), NOW, newId).cycleId).toBe(
      "cycle-1",
    );
  });

  it("records pausedMs and resets it for the next phase and idle", () => {
    const next: TimerTransition = {
      state: { ...workRunning, phase: "shortBreak" },
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
    const out = bookkeep(
      workRunning,
      next,
      stored({ phasePausedMs: 90_000 }),
      NOW,
      newId,
    );
    expect(out.sessions.at(-1)?.pausedMs).toBe(90_000);
    expect(out.phasePausedMs).toBe(0);

    const same: TimerTransition = { state: workRunning, events: [] };
    expect(
      bookkeep(workRunning, same, stored({ phasePausedMs: 5 }), NOW, newId)
        .phasePausedMs,
    ).toBe(5);
  });
});

import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/features/auth/session")>()),
  isSignedIn: async () => true,
}));
import { dispatch } from "@/worker/controller";
import { registerTaskHandlers } from "@/features/tasks/worker";
import { registerTimerHandlers } from "@/features/timer/worker";
import { getLocal, setLocal } from "@/shared/storage";
import type { Task } from "@/shared/types";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

async function fireAlarm(name: string) {
  const alarm = await fakeBrowser.alarms.get(name);
  await fakeBrowser.alarms.onAlarm.trigger(
    alarm ?? { name, scheduledTime: Date.now(), persistAcrossSessions: false },
  );
}

async function run(t: Task) {
  await setLocal({ tasks: [t], activeTaskId: t.id });
  await dispatch({ type: "timer/start" });
  vi.setSystemTime(T0 + 5 * MIN);
}
const task: Task = {
  id: "t1",
  title: "Write essay",
  steps: [
    { id: "s1", title: "Outline", done: false },
    { id: "s2", title: "Draft", done: false },
  ],
  createdAt: T0,
  doneAt: null,
};

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  registerTaskHandlers();
  registerTimerHandlers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("task handlers", () => {
  it("task/save upserts by id", async () => {
    await dispatch({ type: "task/save", task });
    await dispatch({
      type: "task/save",
      task: { ...task, title: "Write long essay" },
    });
    const tasks = await getLocal("tasks");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Write long essay");
  });

  it("task/setActive stores the id", async () => {
    await dispatch({ type: "task/setActive", taskId: "t1" });
    expect(await getLocal("activeTaskId")).toBe("t1");
  });

  it("step/toggle flips done and celebrates only when it becomes done", async () => {
    await setLocal({ tasks: [task] });
    await dispatch({ type: "step/toggle", taskId: "t1", stepId: "s1" });
    expect((await getLocal("tasks"))[0]?.steps[0]?.done).toBe(true);
    expect((await getLocal("transient")).celebrateUntil).toBe(T0 + 3000);

    await setLocal({
      transient: { ...(await getLocal("transient")), celebrateUntil: 0 },
    });
    await dispatch({ type: "step/toggle", taskId: "t1", stepId: "s1" });
    expect((await getLocal("tasks"))[0]?.steps[0]?.done).toBe(false);
    expect((await getLocal("transient")).celebrateUntil).toBe(0);
  });

  it("checkin/answer with a step marks it done and clears the flag", async () => {
    await setLocal({
      tasks: [task],
      activeTaskId: "t1",
      transient: {
        checkInPending: true,
        checkInTaskId: null,
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
        inviteSince: 0,
      },
    });
    await fakeBrowser.notifications.create("checkin", {
      type: "basic",
      iconUrl: "x",
      title: "a",
      message: "b",
    });
    await dispatch({ type: "checkin/answer", stepId: "s2" });
    expect((await getLocal("tasks"))[0]?.steps[1]?.done).toBe(true);
    expect((await getLocal("transient")).checkInPending).toBe(false);
    expect(fakeBrowser.notifications.getAllCreateOptions()).toEqual({});
  });

  it("checkin/answer with null only clears the flag", async () => {
    await setLocal({
      tasks: [task],
      activeTaskId: "t1",
      transient: {
        checkInPending: true,
        checkInTaskId: null,
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
        inviteSince: 0,
      },
    });
    await dispatch({ type: "checkin/answer", stepId: null });
    expect((await getLocal("tasks"))[0]?.steps.every((s) => !s.done)).toBe(
      true,
    );
    expect((await getLocal("transient")).checkInPending).toBe(false);
  });

  it("park keeps the time left", async () => {
    await run(task);
    await dispatch({ type: "task/park" });
    const t1 = (await getLocal("tasks"))[0];
    expect(t1?.parked?.remainingMs).toBe(20 * MIN);
    expect(await getLocal("activeTaskId")).toBeNull();
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("stop parks the active task", async () => {
    await run(task);
    await dispatch({ type: "timer/stop" });
    expect((await getLocal("tasks"))[0]?.parked?.remainingMs).toBe(20 * MIN);
    expect(await getLocal("activeTaskId")).toBeNull();
    expect((await getLocal("sessions"))[0]?.taskId).toBe("t1");
  });

  it("resume continues from the saved time and cycle", async () => {
    await setLocal({
      tasks: [
        {
          ...task,
          parked: { remainingMs: 18 * MIN, blocksCompleted: 2, parkedAt: T0 },
        },
      ],
    });
    await dispatch({ type: "task/resume", taskId: "t1" });
    const timer = await getLocal("timer");
    expect(timer.phaseEndsAt).toBe(T0 + 18 * MIN);
    expect(timer.blocksCompleted).toBe(2);
    const t1 = (await getLocal("tasks"))[0];
    expect(t1?.parked == null).toBe(true);
    expect(await getLocal("activeTaskId")).toBe("t1");
    expect(t1?.lastActiveAt).toBe(T0);
  });

  it("resume with an earlier endBy shortens the block", async () => {
    await setLocal({
      tasks: [
        {
          ...task,
          parked: { remainingMs: 18 * MIN, blocksCompleted: 2, parkedAt: T0 },
        },
      ],
    });
    await dispatch({ type: "task/resume", taskId: "t1", endBy: T0 + 10 * MIN });
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 10 * MIN);
  });

  it("resume parks the running task first", async () => {
    await run(task);
    await setLocal({
      tasks: [task, { ...task, id: "t2", title: "Other" }],
    });
    await dispatch({ type: "task/resume", taskId: "t2" });
    const tasks = await getLocal("tasks");
    expect(tasks.find((t) => t.id === "t1")?.parked?.remainingMs).toBe(
      20 * MIN,
    );
    expect(await getLocal("activeTaskId")).toBe("t2");
    expect((await getLocal("timer")).phase).toBe("work");
  });

  it("markDone on the active task stops the timer", async () => {
    await run(task);
    await dispatch({ type: "task/markDone", taskId: "t1" });
    const t1 = (await getLocal("tasks"))[0];
    expect(t1?.doneAt).toBe(T0 + 5 * MIN);
    expect(t1?.parked == null).toBe(true);
    expect((await getLocal("timer")).phase).toBe("idle");
    expect(await getLocal("activeTaskId")).toBeNull();
    expect((await getLocal("transient")).celebrateUntil).toBe(
      T0 + 5 * MIN + 3000,
    );
  });

  it("reopen clears doneAt and bumps lastActiveAt without touching the timer", async () => {
    await setLocal({ tasks: [{ ...task, doneAt: T0 }] });
    vi.setSystemTime(T0 + MIN);
    await dispatch({ type: "task/reopen", taskId: "t1" });
    const t1 = (await getLocal("tasks"))[0];
    expect(t1?.doneAt).toBeNull();
    expect(t1?.lastActiveAt).toBe(T0 + MIN);
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("delete on the active task stops the timer", async () => {
    await run(task);
    await dispatch({ type: "task/delete", taskId: "t1" });
    expect(await getLocal("tasks")).toEqual([]);
    expect((await getLocal("timer")).phase).toBe("idle");
    expect(await getLocal("activeTaskId")).toBeNull();
  });

  it("clearDone removes only done tasks", async () => {
    await setLocal({
      tasks: [task, { ...task, id: "t2", doneAt: T0 }],
    });
    await dispatch({ type: "task/clearDone" });
    expect((await getLocal("tasks")).map((t) => t.id)).toEqual(["t1"]);
  });

  it("ticking the last step marks the task done but keeps it active", async () => {
    await run(task);
    await dispatch({ type: "step/toggle", taskId: "t1", stepId: "s1" });
    expect((await getLocal("tasks"))[0]?.doneAt).toBeNull();
    await dispatch({ type: "step/toggle", taskId: "t1", stepId: "s2" });
    expect((await getLocal("tasks"))[0]?.doneAt).toBe(T0 + 5 * MIN);
    expect((await getLocal("timer")).phase).toBe("work");
    await dispatch({ type: "step/toggle", taskId: "t1", stepId: "s2" });
    expect((await getLocal("tasks"))[0]?.doneAt).toBeNull();
  });

  it("task/save sets lastActiveAt", async () => {
    await dispatch({ type: "task/save", task });
    expect((await getLocal("tasks"))[0]?.lastActiveAt).toBe(T0);
  });

  it("check-in stays pending after parking and ticks the right task", async () => {
    await setLocal({ tasks: [task], activeTaskId: "t1" });
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN);
    await fireAlarm("timer-phase");
    expect((await getLocal("transient")).checkInTaskId).toBe("t1");
    await dispatch({ type: "task/park" });
    expect((await getLocal("transient")).checkInPending).toBe(true);
    await dispatch({ type: "checkin/answer", stepId: "s1" });
    expect((await getLocal("tasks"))[0]?.steps[0]?.done).toBe(true);
    expect((await getLocal("transient")).checkInPending).toBe(false);
  });

  it("answering the check-in with the last open step marks the task done", async () => {
    const oneLeft = {
      ...task,
      steps: [
        { id: "s1", title: "Outline", done: true },
        { id: "s2", title: "Draft", done: false },
      ],
    };
    await setLocal({ tasks: [oneLeft], activeTaskId: "t1" });
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN);
    await fireAlarm("timer-phase");
    await dispatch({ type: "checkin/answer", stepId: "s2" });
    expect((await getLocal("tasks"))[0]?.doneAt).toBe(T0 + 25 * MIN);
  });

  it("an overdue stop keeps the block's check-in pending", async () => {
    await setLocal({ tasks: [task], activeTaskId: "t1" });
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 26 * MIN);
    await dispatch({ type: "timer/stop" });
    const transient = await getLocal("transient");
    expect(transient.checkInPending).toBe(true);
    expect(transient.checkInTaskId).toBe("t1");
  });

  it("resuming the running task keeps its time left", async () => {
    await run(task);
    await dispatch({ type: "task/resume", taskId: "t1" });
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 25 * MIN);
  });

  it("resume ignores an endBy in the past", async () => {
    await setLocal({
      tasks: [
        {
          ...task,
          parked: { remainingMs: 18 * MIN, blocksCompleted: 0, parkedAt: T0 },
        },
      ],
    });
    await dispatch({ type: "task/resume", taskId: "t1", endBy: T0 - MIN });
    expect((await getLocal("timer")).phaseEndsAt).toBe(T0 + 18 * MIN);
  });

  it("deleting a task clears its pending check-in", async () => {
    await setLocal({ tasks: [task], activeTaskId: "t1" });
    await dispatch({ type: "timer/start" });
    vi.setSystemTime(T0 + 25 * MIN);
    await fireAlarm("timer-phase");
    await dispatch({ type: "task/park" });
    await dispatch({ type: "task/delete", taskId: "t1" });
    const transient = await getLocal("transient");
    expect(transient.checkInPending).toBe(false);
    expect(transient.checkInTaskId).toBeNull();
  });

  it("task/save keeps an existing lastActiveAt", async () => {
    await dispatch({ type: "task/save", task: { ...task, lastActiveAt: 5 } });
    expect((await getLocal("tasks"))[0]?.lastActiveAt).toBe(5);
  });
});

import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  isSignedIn: async () => true,
}));
import { dispatch } from "@/background/controller";
import { registerTaskHandlers } from "@/background/tasks";
import { getLocal, setLocal } from "@/lib/storage";
import type { Task } from "@/lib/types";

const T0 = 1_700_000_000_000;
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
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
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
        nudgeText: null,
        nudgeUntil: 0,
        celebrateUntil: 0,
      },
    });
    await dispatch({ type: "checkin/answer", stepId: null });
    expect((await getLocal("tasks"))[0]?.steps.every((s) => !s.done)).toBe(
      true,
    );
    expect((await getLocal("transient")).checkInPending).toBe(false);
  });
});

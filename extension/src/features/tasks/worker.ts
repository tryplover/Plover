import { browser } from "wxt/browser";
import { DecomposeError, suggestSteps } from "@/features/tasks/decompose";
import { resumePlan } from "@/features/tasks/parking";
import { startTimerNow, stopAndPark } from "@/features/timer/worker";
import { getLocal, getSettings, setLocal, timerConfig } from "@/shared/storage";
import { registerHandler } from "@/worker/controller";
import { enqueue } from "@/worker/queue";

const CELEBRATE_MS = 3000;

export function registerTaskHandlers(): void {
  registerHandler("task/decompose", async ({ text }) => {
    try {
      return { ok: true, data: { steps: await suggestSteps(text) } };
    } catch (e) {
      if (e instanceof DecomposeError && e.status === 401) {
        await enqueue(() => setLocal({ needsSignIn: true }));
      }
      const retryAfterSeconds =
        e instanceof DecomposeError ? e.retryAfterSeconds : null;
      return {
        ok: true,
        data:
          retryAfterSeconds === null
            ? { steps: [], aiFailed: true }
            : { steps: [], aiFailed: true, limitedFor: retryAfterSeconds },
      };
    }
  });

  registerHandler("task/save", async ({ task: saved }) => {
    const task = { ...saved, lastActiveAt: saved.lastActiveAt ?? Date.now() };
    const tasks = await getLocal("tasks");
    const exists = tasks.some((t) => t.id === task.id);
    await setLocal({
      tasks: exists
        ? tasks.map((t) => (t.id === task.id ? task : t))
        : [...tasks, task],
    });
    return { ok: true };
  });

  registerHandler("task/setActive", async ({ taskId }) => {
    await setLocal({ activeTaskId: taskId });
    return { ok: true };
  });

  registerHandler("step/toggle", async ({ taskId, stepId }) => {
    const tasks = await getLocal("tasks");
    let becameDone = false;
    const now = Date.now();
    const next = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const steps = t.steps.map((s) => {
        if (s.id !== stepId) return s;
        becameDone = !s.done;
        return { ...s, done: !s.done };
      });
      const allDone = steps.length > 0 && steps.every((s) => s.done);
      return { ...t, steps, doneAt: allDone ? (t.doneAt ?? now) : null };
    });
    const patch: Parameters<typeof setLocal>[0] = { tasks: next };
    if (becameDone) {
      patch.transient = {
        ...(await getLocal("transient")),
        celebrateUntil: Date.now() + CELEBRATE_MS,
      };
    }
    await setLocal(patch);
    return { ok: true };
  });

  registerHandler("checkin/answer", async ({ stepId }) => {
    const [tasks, activeTaskId, transient] = await Promise.all([
      getLocal("tasks"),
      getLocal("activeTaskId"),
      getLocal("transient"),
    ]);
    const targetId = transient.checkInTaskId ?? activeTaskId;
    const now = Date.now();
    const next =
      stepId === null
        ? tasks
        : tasks.map((t) => {
            if (t.id !== targetId) return t;
            const steps = t.steps.map((s) =>
              s.id === stepId ? { ...s, done: true } : s,
            );
            const allDone = steps.every((s) => s.done);
            return { ...t, steps, doneAt: allDone ? (t.doneAt ?? now) : null };
          });
    await setLocal({
      tasks: next,
      transient: { ...transient, checkInPending: false, checkInTaskId: null },
    });
    await browser.notifications.clear("checkin");
    return { ok: true };
  });

  registerHandler("task/park", async () => {
    await stopAndPark(Date.now());
    return { ok: true };
  });

  registerHandler("task/resume", async ({ taskId, endBy }) => {
    const now = Date.now();
    const found = (await getLocal("tasks")).find((t) => t.id === taskId);
    if (!found || found.doneAt !== null) {
      return { ok: false, error: "Task not found" };
    }
    if ((await getLocal("timer")).phase !== "idle") await stopAndPark(now);
    const task =
      (await getLocal("tasks")).find((t) => t.id === taskId) ?? found;
    await setLocal({
      activeTaskId: taskId,
      tasks: (await getLocal("tasks")).map((t) =>
        t.id === taskId ? { ...t, parked: null, lastActiveAt: now } : t,
      ),
    });
    const plan = resumePlan(task, timerConfig(await getSettings()), now);
    await startTimerNow(
      endBy !== undefined && endBy > now
        ? Math.min(plan.endBy, endBy)
        : plan.endBy,
      plan.blocksCompleted,
    );
    return { ok: true };
  });

  registerHandler("task/markDone", async ({ taskId }) => {
    const now = Date.now();
    await setLocal({
      tasks: (await getLocal("tasks")).map((t) =>
        t.id === taskId ? { ...t, doneAt: t.doneAt ?? now, parked: null } : t,
      ),
    });
    if ((await getLocal("activeTaskId")) === taskId) await stopAndPark(now);
    await setLocal({
      transient: {
        ...(await getLocal("transient")),
        celebrateUntil: Date.now() + CELEBRATE_MS,
      },
    });
    return { ok: true };
  });

  registerHandler("task/reopen", async ({ taskId }) => {
    const now = Date.now();
    await setLocal({
      tasks: (await getLocal("tasks")).map((t) =>
        t.id === taskId ? { ...t, doneAt: null, lastActiveAt: now } : t,
      ),
    });
    return { ok: true };
  });

  registerHandler("task/delete", async ({ taskId }) => {
    if ((await getLocal("activeTaskId")) === taskId) {
      await stopAndPark(Date.now());
    }
    const transient = await getLocal("transient");
    await setLocal({
      tasks: (await getLocal("tasks")).filter((t) => t.id !== taskId),
      ...(transient.checkInTaskId === taskId && {
        transient: { ...transient, checkInPending: false, checkInTaskId: null },
      }),
    });
    return { ok: true };
  });

  registerHandler("task/clearDone", async () => {
    await setLocal({
      tasks: (await getLocal("tasks")).filter((t) => t.doneAt === null),
    });
    return { ok: true };
  });
}

import { browser } from "wxt/browser";
import { DecomposeError, suggestSteps } from "@/lib/api/decompose";
import { getLocal, setLocal } from "@/lib/storage";
import { registerHandler } from "./controller";

const CELEBRATE_MS = 3000;

export function registerTaskHandlers(): void {
  registerHandler("task/decompose", async ({ text }) => {
    try {
      return { ok: true, data: { steps: await suggestSteps(text) } };
    } catch (e) {
      if (e instanceof DecomposeError && e.status === 401) {
        await setLocal({ needsSignIn: true });
      }
      return { ok: true, data: { steps: [], aiFailed: true } };
    }
  });

  registerHandler("task/save", async ({ task }) => {
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
    const next = tasks.map((t) =>
      t.id !== taskId
        ? t
        : {
            ...t,
            steps: t.steps.map((s) => {
              if (s.id !== stepId) return s;
              becameDone = !s.done;
              return { ...s, done: !s.done };
            }),
          },
    );
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
    const next =
      stepId === null
        ? tasks
        : tasks.map((t) =>
            t.id !== activeTaskId
              ? t
              : {
                  ...t,
                  steps: t.steps.map((s) =>
                    s.id === stepId ? { ...s, done: true } : s,
                  ),
                },
          );
    await setLocal({
      tasks: next,
      transient: { ...transient, checkInPending: false },
    });
    await browser.notifications.clear("checkin");
    return { ok: true };
  });
}

import { firstOpenStep } from "@/features/tasks/active-step";
import { sendCommand } from "@/shared/messages";
import type { Task } from "@/shared/types";

export function ActiveSteps({ task }: { task: Task }) {
  if (task.steps.length === 0) return null;
  const currentId = firstOpenStep(task)?.id;
  return (
    <ul className="plover-steps">
      {task.steps.map((s) => {
        const current = s.id === currentId;
        return (
          <li
            key={s.id}
            className={
              "plover-step" +
              (current ? " plover-step-current" : "") +
              (s.done ? " plover-step-done" : "")
            }
          >
            <label>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() =>
                  void sendCommand({
                    type: "step/toggle",
                    taskId: task.id,
                    stepId: s.id,
                  })
                }
              />
              {s.title}
            </label>
            {current && <span className="plover-now">Now</span>}
          </li>
        );
      })}
    </ul>
  );
}

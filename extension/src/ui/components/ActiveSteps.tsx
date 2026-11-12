import type { KeyboardEvent } from "react";
import { firstOpenStep } from "@/features/tasks/active-step";
import { sendCommand } from "@/shared/messages";
import type { Task } from "@/shared/types";

function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
  if (e.key === "Enter") {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.type === "checkbox") {
      e.preventDefault();
      active.click();
    }
    return;
  }
  const nav = ["ArrowDown", "ArrowUp", "Home", "End", "j", "k"];
  if (!nav.includes(e.key)) return;
  const boxes = Array.from(
    e.currentTarget.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ),
  );
  if (boxes.length === 0) return;
  e.preventDefault();
  const i = boxes.findIndex((b) => b === document.activeElement);
  const last = boxes.length - 1;
  let next: number;
  if (e.key === "Home") next = 0;
  else if (e.key === "End") next = last;
  else if (e.key === "ArrowDown" || e.key === "j")
    next = i < 0 ? 0 : Math.min(i + 1, last);
  else next = i < 0 ? last : Math.max(i - 1, 0);
  boxes[next]?.focus();
}

export function ActiveSteps({ task }: { task: Task }) {
  if (task.steps.length === 0) return null;
  const currentId = firstOpenStep(task)?.id;
  return (
    <ul className="plover-steps" onKeyDown={onKeyDown}>
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

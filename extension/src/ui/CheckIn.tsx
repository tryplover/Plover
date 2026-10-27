import { sendCommand } from "@/lib/messages";
import type { Task } from "@/lib/types";

export function CheckIn({ task }: { task: Task | undefined }) {
  const open = task?.steps.filter((s) => !s.done) ?? [];
  return (
    <div className="plover-checkin" role="group" aria-label="Check-in">
      <p>Which step did you finish?</p>
      {open.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            void sendCommand({ type: "checkin/answer", stepId: s.id })
          }
        >
          {s.title}
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          void sendCommand({ type: "checkin/answer", stepId: null })
        }
      >
        None yet
      </button>
    </div>
  );
}

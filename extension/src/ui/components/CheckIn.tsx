import { useEffect, useRef, useState } from "react";
import { sendCommand } from "@/shared/messages";
import type { Task } from "@/shared/types";

export function CheckIn({ task }: { task: Task | undefined }) {
  const open = task?.steps.filter((s) => !s.done) ?? [];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focused] = useState(() => document.hasFocus());
  useEffect(() => {
    if (focused) headingRef.current?.focus();
  }, [focused]);
  return (
    <div className="plover-checkin" role="group" aria-label="Check-in">
      {!focused && (
        <p className="plover-sr" role="alert">
          Check-in: which step did you finish?
        </p>
      )}
      <h2 ref={headingRef} tabIndex={-1} className="plover-heading">
        Which step did you finish?
      </h2>
      {open.map((s) => (
        <button
          key={s.id}
          type="button"
          className="plover-checkin-step"
          onClick={() =>
            void sendCommand({ type: "checkin/answer", stepId: s.id })
          }
        >
          {s.title}
        </button>
      ))}
      <button
        type="button"
        className="plover-btn-text"
        onClick={() =>
          void sendCommand({ type: "checkin/answer", stepId: null })
        }
      >
        None yet
      </button>
    </div>
  );
}

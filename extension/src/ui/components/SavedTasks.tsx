import { useEffect, useRef, useState } from "react";
import { conflictDuring } from "@/features/calendar/events";
import { savedTaskCaption, sortSavedTasks } from "@/features/tasks/parking";
import { sendCommand } from "@/shared/messages";
import type { CalendarEvent, Task } from "@/shared/types";
import { ConflictOffer } from "@/ui/components/CalendarNext";
import { formatClock } from "@/ui/components/TimerControls";

const UNDO_MS = 5000;

export function SavedTasks({
  tasks,
  activeTaskId,
  events,
  workMinutes,
  blocksPerLongBreak,
  now,
}: {
  tasks: Task[];
  activeTaskId: string | null;
  events: CalendarEvent[];
  workMinutes: number;
  blocksPerLongBreak: number;
  now: number;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    task: Task;
    event: CalendarEvent;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const { open, done } = sortSavedTasks(tasks, activeTaskId);
  if (open.length === 0 && done.length === 0) return null;

  function resume(task: Task, endBy?: number) {
    setConflict(null);
    void sendCommand({ type: "task/resume", taskId: task.id, endBy });
  }

  function tryResume(task: Task) {
    const remaining = task.parked?.remainingMs ?? workMinutes * 60_000;
    const event = conflictDuring(events, now, now + remaining);
    if (event) setConflict({ task, event });
    else resume(task);
  }

  function startDelete(task: Task) {
    if (timer.current) clearTimeout(timer.current);
    setMenuId(null);
    setDeleting(task.id);
    timer.current = setTimeout(() => {
      timer.current = null;
      setDeleting(null);
      void sendCommand({ type: "task/delete", taskId: task.id });
    }, UNDO_MS);
  }

  function undoDelete() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDeleting(null);
  }

  function remove(task: Task) {
    void sendCommand({ type: "task/delete", taskId: task.id });
  }

  return (
    <div className="plover-saved">
      <p className="plover-eyebrow">Your tasks</p>
      {open.map((task) =>
        deleting === task.id ? (
          <div key={task.id} className="plover-saved-row">
            <p className="plover-saved-title">Delete this task?</p>
            <button
              type="button"
              className="plover-btn-text"
              onClick={undoDelete}
            >
              Undo
            </button>
          </div>
        ) : (
          <div key={task.id}>
            <div className="plover-saved-row">
              <div className="plover-saved-text">
                <p className="plover-saved-title">{task.title}</p>
                <p className="plover-saved-meta">
                  {savedTaskCaption(task, blocksPerLongBreak)}
                </p>
              </div>
              <div className="plover-saved-side">
                <p className="plover-saved-meta">
                  {task.parked
                    ? `${formatClock(Math.ceil(task.parked.remainingMs / 1000))} left`
                    : formatClock(workMinutes * 60)}
                </p>
                <div className="plover-row">
                  <button
                    type="button"
                    className="plover-btn-text"
                    onClick={() => tryResume(task)}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="plover-btn-text"
                    aria-label="More actions"
                    aria-expanded={menuId === task.id}
                    onClick={() =>
                      setMenuId(menuId === task.id ? null : task.id)
                    }
                  >
                    ⋯
                  </button>
                </div>
              </div>
            </div>
            {menuId === task.id && (
              <div className="plover-row plover-saved-menu">
                <button
                  type="button"
                  className="plover-btn-text"
                  onClick={() => {
                    setMenuId(null);
                    void sendCommand({ type: "task/markDone", taskId: task.id });
                  }}
                >
                  Mark done
                </button>
                <button
                  type="button"
                  className="plover-btn-text"
                  onClick={() => startDelete(task)}
                >
                  Delete
                </button>
              </div>
            )}
            {conflict?.task.id === task.id && (
              <ConflictOffer
                event={conflict.event}
                now={now}
                onShorten={(endBy) => resume(task, endBy)}
                onAnyway={() => resume(task)}
              />
            )}
          </div>
        ),
      )}
      {done.length > 0 && (
        <>
          <button
            type="button"
            className="plover-btn-text plover-link"
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
          >
            {`Done (${done.length}) ${showDone ? "▾" : "▸"}`}
          </button>
          {showDone && (
            <>
              {done.map((task) => (
                <div key={task.id} className="plover-saved-row">
                  <div className="plover-saved-text">
                    <p className="plover-saved-title">{task.title}</p>
                    <p className="plover-saved-meta">
                      {new Date(task.doneAt ?? 0).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="plover-btn-text"
                    onClick={() => remove(task)}
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="plover-btn-text plover-link"
                onClick={() => void sendCommand({ type: "task/clearDone" })}
              >
                Clear done
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

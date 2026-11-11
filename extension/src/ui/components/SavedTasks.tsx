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
  justDone,
  onJustDoneExpired,
}: {
  tasks: Task[];
  activeTaskId: string | null;
  events: CalendarEvent[];
  workMinutes: number;
  blocksPerLongBreak: number;
  now: number;
  justDone: { id: string; title: string } | null;
  onJustDoneExpired: () => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    task: Task;
    event: CalendarEvent;
  } | null>(null);
  const [deleted, setDeleted] = useState<Task | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finished, setFinished] = useState<{
    id: string;
    title: string;
  } | null>(justDone);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armDoneTimer() {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => {
      doneTimer.current = null;
      setFinished(null);
      onJustDoneExpired();
    }, UNDO_MS);
  }

  useEffect(() => {
    if (justDone) armDoneTimer();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { open } = sortSavedTasks(tasks, activeTaskId);
  if (open.length === 0 && !deleted && !finished) return null;

  function markDone(task: Task) {
    setMenuId(null);
    setFinished({ id: task.id, title: task.title });
    armDoneTimer();
    void sendCommand({ type: "task/markDone", taskId: task.id });
  }

  function undoDone() {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = null;
    if (finished)
      void sendCommand({ type: "task/reopen", taskId: finished.id });
    setFinished(null);
    onJustDoneExpired();
  }

  function resume(task: Task, endBy?: number) {
    setConflict(null);
    setNotice(null);
    void sendCommand({ type: "task/resume", taskId: task.id, endBy }).then(
      (res) => {
        if (!res.ok) setNotice(res.error);
      },
    );
  }

  function tryResume(task: Task) {
    const remaining = task.parked?.remainingMs ?? workMinutes * 60_000;
    const event = conflictDuring(events, now, now + remaining);
    if (event) setConflict({ task, event });
    else resume(task);
  }

  function startDelete(task: Task) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setMenuId(null);
    setDeleted(task);
    void sendCommand({ type: "task/delete", taskId: task.id });
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setDeleted(null);
    }, UNDO_MS);
  }

  function undoDelete() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    if (deleted) void sendCommand({ type: "task/save", task: deleted });
    setDeleted(null);
  }

  return (
    <div className="plover-saved">
      <p className="plover-eyebrow">Your tasks</p>
      {deleted && (
        <div className="plover-saved-row" role="status">
          <p className="plover-saved-title" title={deleted.title}>
            Deleted “{deleted.title}”
          </p>
          <button
            type="button"
            className="plover-btn-text"
            autoFocus
            onClick={undoDelete}
          >
            Undo
          </button>
        </div>
      )}
      {finished && (
        <div className="plover-saved-row" role="status">
          <p className="plover-saved-title" title={finished.title}>
            Done: “{finished.title}”
          </p>
          <button
            type="button"
            className="plover-btn-text"
            autoFocus
            onClick={undoDone}
          >
            Undo
          </button>
        </div>
      )}
      {notice && <p className="plover-saved-meta">{notice}</p>}
      {open.map((task) => (
        <div key={task.id}>
          <div className="plover-saved-row">
            <div className="plover-saved-text">
              <p className="plover-saved-title" title={task.title}>
                {task.title}
              </p>
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
                  aria-label={`Resume ${task.title}`}
                  onClick={() => tryResume(task)}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className="plover-btn-text"
                  aria-label={`More actions for ${task.title}`}
                  aria-expanded={menuId === task.id}
                  aria-controls={`plover-saved-menu-${task.id}`}
                  onClick={() => setMenuId(menuId === task.id ? null : task.id)}
                >
                  ⋯
                </button>
              </div>
            </div>
          </div>
          {menuId === task.id && (
            <div
              id={`plover-saved-menu-${task.id}`}
              className="plover-row plover-saved-menu"
            >
              <button
                type="button"
                className="plover-btn-text"
                onClick={() => markDone(task)}
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
      ))}
    </div>
  );
}

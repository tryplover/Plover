import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  formatDuration,
  groupDoneByDay,
  historyTotals,
  taskStats,
} from "@/features/tasks/history";
import { sendCommand } from "@/shared/messages";
import type { Task } from "@/shared/types";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./task-history.css";

const UNDO_MS = 5000;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function TaskCard({
  task,
  blocks,
  focusMs,
  onReopen,
  onDelete,
}: {
  task: Task;
  blocks: number;
  focusMs: number;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const stepsDone = task.steps.filter((s) => s.done).length;
  const time = new Date(task.doneAt ?? 0).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="history-card">
      <p className="history-title">{task.title}</p>
      <p className="history-meta">
        {`${stepsDone} of ${task.steps.length} steps · ${plural(blocks, "block")} · ${formatDuration(focusMs)} · ${time}`}
      </p>
      {open && (
        <ul className="history-steps" id={`history-steps-${task.id}`}>
          {task.steps.map((s) => (
            <li key={s.id}>{s.done ? `✓ ${s.title}` : s.title}</li>
          ))}
        </ul>
      )}
      <div className="history-actions">
        {task.steps.length > 0 && (
          <button
            type="button"
            className="plover-btn-text"
            aria-expanded={open}
            aria-controls={`history-steps-${task.id}`}
            onClick={() => setOpen(!open)}
          >
            {`Steps ${open ? "▾" : "▸"}`}
          </button>
        )}
        <button
          type="button"
          className="plover-btn-text"
          aria-label={`Reopen ${task.title}`}
          onClick={onReopen}
        >
          Reopen
        </button>
        <button
          type="button"
          className="plover-btn-text"
          aria-label={`Delete ${task.title}`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function History() {
  const { local, now, ready } = useExtensionState();
  const [deleted, setDeleted] = useState<Task | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  if (!ready) return null;

  const doneTasks = local.tasks.filter((t) => t.doneAt !== null);
  const totals = historyTotals(doneTasks, local.sessions);
  const groups = groupDoneByDay(local.tasks, now);

  function startDelete(task: Task) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setNotice(null);
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

  function reopen(task: Task) {
    setDeleted(null);
    void sendCommand({ type: "task/reopen", taskId: task.id }).then(() =>
      setNotice("Moved back to Your tasks."),
    );
  }

  return (
    <main className="history">
      <header className="history-header">
        <p className="plover-eyebrow">History</p>
        <h1 className="plover-heading">What you've finished</h1>
        <p className="history-summary">
          {`${plural(totals.tasks, "task")} · ${plural(totals.blocks, "focus block")} · ${formatDuration(totals.focusMs)} focused`}
        </p>
      </header>
      {deleted && (
        <div className="history-status" role="status">
          <span>Deleted “{deleted.title}”</span>
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
      {notice && (
        <p className="history-status" role="status">
          {notice}
        </p>
      )}
      {groups.length === 0 && !deleted && (
        <p className="history-empty">
          Nothing finished yet. Tasks you finish show up here.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.label} className="history-group">
          <h2 className="history-day">{group.label}</h2>
          <ul className="history-list">
            {group.tasks.map((task) => {
              const stats = taskStats(task, local.sessions);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  blocks={stats.blocks}
                  focusMs={stats.focusMs}
                  onReopen={() => reopen(task)}
                  onDelete={() => startDelete(task)}
                />
              );
            })}
          </ul>
        </section>
      ))}
      {doneTasks.length > 0 && (
        <footer className="history-footer">
          {confirmClear ? (
            <>
              <p>{`Delete all ${doneTasks.length} finished tasks? This can't be undone.`}</p>
              <div className="history-actions">
                <button
                  type="button"
                  className="plover-btn-text"
                  onClick={() => {
                    setConfirmClear(false);
                    void sendCommand({ type: "task/clearDone" });
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="plover-btn-text"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="plover-btn-text plover-link"
              onClick={() => setConfirmClear(true)}
            >
              Clear history
            </button>
          )}
        </footer>
      )}
    </main>
  );
}

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<History />);
}

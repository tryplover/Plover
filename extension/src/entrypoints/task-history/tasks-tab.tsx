import { useEffect, useRef, useState } from "react";
import {
  formatDuration,
  groupDoneByDay,
  taskStats,
} from "@/features/tasks/history";
import { vaultSearch } from "@/features/stats/stats";
import { sendCommand } from "@/shared/messages";
import type { Session, Task } from "@/shared/types";

const UNDO_MS = 5000;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function TaskCard({
  task,
  blocks,
  focusMs,
  showDate,
  onReopen,
  onDelete,
}: {
  task: Task;
  blocks: number;
  focusMs: number;
  showDate: boolean;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const stepsDone = task.steps.filter((s) => s.done).length;
  const time = new Date(task.doneAt ?? 0).toLocaleString([], {
    ...(showDate && { month: "short", day: "numeric" }),
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
            <li
              key={s.id}
              className={`history-step${s.done ? " history-step-done" : ""}`}
            >
              <span className="history-step-mark" aria-hidden="true">
                {s.done ? "✓" : "○"}
              </span>
              <span className="history-step-text">{s.title}</span>
            </li>
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

export function TasksTab({
  tasks,
  sessions,
  now,
}: {
  tasks: Task[];
  sessions: Session[];
  now: number;
}) {
  const [deleted, setDeleted] = useState<Task | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const searching = query.trim() !== "";
  const groups = groupDoneByDay(tasks, now);
  const matches = vaultSearch(tasks, query).sort(
    (a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0),
  );

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

  function card(task: Task) {
    const stats = taskStats(task, sessions);
    return (
      <TaskCard
        key={task.id}
        task={task}
        blocks={stats.blocks}
        focusMs={stats.focusMs}
        showDate={searching}
        onReopen={() => reopen(task)}
        onDelete={() => startDelete(task)}
      />
    );
  }

  return (
    <>
      <input
        type="text"
        className="history-search"
        placeholder="Search past tasks"
        aria-label="Search past tasks"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
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
      {searching && groups.length > 0 && matches.length === 0 && (
        <p className="history-empty">No finished tasks match.</p>
      )}
      {searching ? (
        <ul className="history-list">{matches.map(card)}</ul>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="history-group">
            <h2 className="history-day">{group.label}</h2>
            <ul className="history-list">{group.tasks.map(card)}</ul>
          </section>
        ))
      )}
    </>
  );
}

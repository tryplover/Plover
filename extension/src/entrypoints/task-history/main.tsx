import { useState } from "react";
import type { KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { summarize, toCsv } from "@/features/stats/stats";
import { formatDuration } from "@/features/tasks/history";
import { sendCommand } from "@/shared/messages";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import { StatsTab } from "./stats-tab";
import { TasksTab } from "./tasks-tab";
import "@/ui/base.css";
import "./task-history.css";

type Tab = "stats" | "tasks";

const TABS: readonly Tab[] = ["stats", "tasks"];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function History() {
  const { local, now, ready } = useExtensionState();
  const [tab, setTab] = useState<Tab>("stats");
  const [confirmClear, setConfirmClear] = useState(false);
  const [alsoStats, setAlsoStats] = useState(false);

  if (!ready) return null;

  const doneTasks = local.tasks.filter((t) => t.doneAt !== null);
  const totals = summarize(
    local.sessions,
    local.tasks,
    0,
    Number.POSITIVE_INFINITY,
  );
  const stamp = new Date(now).toLocaleDateString("en-CA");

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, value: Tab) {
    const last = TABS.length - 1;
    const index = TABS.indexOf(value);
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
        next = index === 0 ? last : index - 1;
        break;
      case "ArrowRight":
        next = index === last ? 0 : index + 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    const target = TABS[next];
    if (!target) return;
    e.preventDefault();
    setTab(target);
    document.getElementById(`tab-${target}`)?.focus();
  }

  function exportJson() {
    download(
      `plover-sessions-${stamp}.json`,
      "application/json",
      JSON.stringify(
        {
          exportedAt: new Date(now).toISOString(),
          tasks: local.tasks,
          sessions: local.sessions,
        },
        null,
        2,
      ),
    );
  }

  return (
    <main className="history">
      <header className="history-header">
        <p className="plover-eyebrow">History</p>
        <h1 className="plover-heading">What you've done</h1>
        <p className="history-summary">
          {`${plural(totals.tasksDone, "task")} finished · ${plural(totals.pomodoros, "focus block")} · ${formatDuration(totals.focusMs)} focused`}
        </p>
      </header>
      <div
        className="segmented history-tabs"
        role="tablist"
        aria-label="History view"
      >
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls="history-panel"
            tabIndex={tab === value ? 0 : -1}
            className="segment"
            onClick={() => setTab(value)}
            onKeyDown={(e) => onTabKeyDown(e, value)}
          >
            {value === "stats" ? "Stats" : "Tasks"}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="history-panel" aria-labelledby={`tab-${tab}`}>
        {tab === "stats" ? (
          <StatsTab sessions={local.sessions} tasks={local.tasks} now={now} />
        ) : (
          <TasksTab tasks={local.tasks} sessions={local.sessions} now={now} />
        )}
      </div>
      <footer className="history-footer">
        <div className="history-actions">
          <button
            type="button"
            onClick={() =>
              download(
                `plover-sessions-${stamp}.csv`,
                "text/csv",
                toCsv(local.sessions),
              )
            }
          >
            Download CSV
          </button>
          <button type="button" onClick={exportJson}>
            Download JSON
          </button>
          {(doneTasks.length > 0 || local.sessions.length > 0) &&
            !confirmClear && (
              <button
                type="button"
                className="history-clear"
                onClick={() => setConfirmClear(true)}
              >
                Clear history
              </button>
            )}
        </div>
        {confirmClear &&
          (doneTasks.length > 0 || local.sessions.length > 0) && (
            <div className="history-clear-confirm">
              <p>{`Delete all ${doneTasks.length} finished tasks? This can't be undone.`}</p>
              <label className="history-check">
                <input
                  type="checkbox"
                  checked={alsoStats}
                  onChange={(e) => setAlsoStats(e.target.checked)}
                />
                Also clear focus stats
              </label>
              <div className="history-actions">
                <button
                  type="button"
                  className="history-clear"
                  onClick={() => {
                    setConfirmClear(false);
                    void sendCommand({ type: "task/clearDone" });
                    if (alsoStats) void sendCommand({ type: "stats/clear" });
                    setAlsoStats(false);
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    setAlsoStats(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
      </footer>
    </main>
  );
}

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<History />);
}

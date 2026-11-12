import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { formatDuration } from "@/features/tasks/history";
import {
  cycleTaskTitles,
  dailyFocus,
  groupCycles,
  paginate,
  rangeStart,
  summarize,
  type Cycle,
  type StatsRange,
} from "@/features/stats/stats";
import type { Session, Task } from "@/shared/types";

const PAGE_SIZE = 10;
const MIN_CHART_SCALE_MS = 30 * 60_000;
const RANGES: { value: StatsRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];
const PHASE_LABEL: Record<Session["phase"], string> = {
  work: "Work",
  shortBreak: "Short break",
  longBreak: "Long break",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function time(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function segmentDuration(s: Session): number {
  return Math.max(0, s.endedAt - s.startedAt - (s.pausedMs ?? 0));
}

const DAY_MS = 24 * 60 * 60_000;

function DayChart({ sessions, now }: { sessions: Session[]; now: number }) {
  const days = dailyFocus(sessions, now);
  const max = Math.max(...days.map((d) => d.focusMs), MIN_CHART_SCALE_MS);
  const [selected, setSelected] = useState(days.length - 1);
  const colRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(to: number) {
    const i = Math.max(0, Math.min(days.length - 1, to));
    setSelected(i);
    colRefs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      Home: 0,
      End: days.length - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    move(map[e.key] as number);
  }

  const sel = days[selected];
  const pomodoros = sel
    ? sessions.filter(
        (s) =>
          s.phase === "work" &&
          s.completed &&
          s.startedAt >= sel.dayStart &&
          s.startedAt < sel.dayStart + DAY_MS,
      ).length
    : 0;
  const fullDate = sel
    ? new Date(sel.dayStart).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <section className="stats-section">
      <h2 className="history-day">Last 7 days</h2>
      <div className="day-chart-nav">
        <button
          type="button"
          className="day-nav"
          aria-label="Previous day"
          disabled={selected === 0}
          onClick={() => move(selected - 1)}
        >
          ‹
        </button>
        <div
          className="day-chart"
          role="group"
          aria-label="Focus time per day"
          onKeyDown={onKeyDown}
        >
          {days.map((d, i) => (
            <button
              key={d.dayStart}
              type="button"
              ref={(el) => {
                colRefs.current[i] = el;
              }}
              className={`day-col${i === selected ? " day-col-selected" : ""}`}
              aria-pressed={i === selected}
              aria-label={`${d.label}: ${formatDuration(d.focusMs)}`}
              onClick={() => setSelected(i)}
            >
              <div className="day-bar-area">
                {d.focusMs >= 60_000 && (
                  <span className="day-value" aria-hidden="true">
                    {formatDuration(d.focusMs)}
                  </span>
                )}
                <div
                  className={`day-bar${i === selected ? " day-bar-selected" : ""}`}
                  style={{
                    height: d.focusMs === 0 ? 2 : `${(d.focusMs / max) * 82}%`,
                  }}
                />
              </div>
              <span className="day-label">{d.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="day-nav"
          aria-label="Next day"
          disabled={selected === days.length - 1}
          onClick={() => move(selected + 1)}
        >
          ›
        </button>
      </div>
      {sel && (
        <p className="day-detail" aria-live="polite">
          <span className="day-detail-date">{fullDate}</span>
          {` · ${formatDuration(sel.focusMs)} focus · ${plural(pomodoros, "pomodoro")}`}
        </p>
      )}
      <table className="history-sr">
        <caption>Focus time per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.dayStart}>
              <th scope="row">{d.label}</th>
              <td>{formatDuration(d.focusMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CycleCard({ cycle }: { cycle: Cycle }) {
  const titles = cycleTaskTitles(cycle);
  const date = new Date(cycle.startedAt).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const total = cycle.segments.reduce(
    (sum, s) => sum + Math.max(s.endedAt - s.startedAt, 1),
    0,
  );
  return (
    <li className="history-card">
      <p className="history-title">{`${date} · ${time(cycle.startedAt)}–${time(cycle.endedAt)}`}</p>
      <p className="history-meta">
        {`${plural(cycle.pomodoros, "pomodoro")} · ${plural(cycle.breaks, "break")} · ${formatDuration(cycle.focusMs)} focus`}
      </p>
      {titles.length > 0 && <p className="history-meta">{titles.join(", ")}</p>}
      <div className="cycle-strip" aria-hidden="true">
        {cycle.segments.map((s) => (
          <span
            key={s.id}
            className={`cycle-seg cycle-seg-${s.phase}${s.skipped || !s.completed ? " cycle-seg-cut" : ""}`}
            style={{
              flexGrow: Math.max(s.endedAt - s.startedAt, 1) / total,
              flexBasis: 4,
            }}
          />
        ))}
      </div>
      <details className="cycle-blocks">
        <summary>Blocks</summary>
        <ul className="history-steps">
          {cycle.segments.map((s) => (
            <li key={s.id}>
              {`${PHASE_LABEL[s.phase]} · ${time(s.startedAt)}–${time(s.endedAt)} · ${formatDuration(segmentDuration(s))}${s.skipped ? " (skipped)" : ""}`}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export function StatsTab({
  sessions,
  tasks,
  now,
}: {
  sessions: Session[];
  tasks: Task[];
  now: number;
}) {
  const [range, setRange] = useState<StatsRange>("week");
  const [page, setPage] = useState(1);
  const cyclesRef = useRef<HTMLElement>(null);
  const summary = summarize(
    sessions,
    tasks,
    rangeStart(range, now),
    Number.POSITIVE_INFINITY,
  );
  const cycles = groupCycles(sessions);
  const pageOf = paginate(cycles, page, PAGE_SIZE);

  function goTo(next: number) {
    setPage(next);
    cyclesRef.current?.scrollIntoView({ block: "start" });
  }

  if (sessions.length === 0) {
    return (
      <p className="history-empty">
        No sessions yet. Start a focus block and your stats show up here.
      </p>
    );
  }

  const breaks = summary.shortBreaks + summary.longBreaks;
  return (
    <>
      <div className="segmented" role="radiogroup" aria-label="Range">
        {RANGES.map(({ value, label }) => (
          <label key={value} className="segment">
            <input
              type="radio"
              name="range"
              value={value}
              checked={range === value}
              onChange={() => setRange(value)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="stat-tiles">
        <div className="stat-tile">
          <p className="stat-value">{formatDuration(summary.focusMs)}</p>
          <p className="history-meta">Focus time</p>
        </div>
        <div className="stat-tile">
          <p className="stat-value">{summary.pomodoros}</p>
          <p className="history-meta">Pomodoros</p>
        </div>
        <div className="stat-tile">
          <p className="stat-value">{breaks}</p>
          <p className="history-meta">Breaks</p>
          <p className="history-meta">{`${summary.shortBreaks} short · ${summary.longBreaks} long`}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-value">{summary.cycles}</p>
          <p className="history-meta">Cycles</p>
        </div>
      </div>
      <p className="history-summary">
        {`${plural(summary.tasksDone, "task")} finished`}
      </p>
      <DayChart sessions={sessions} now={now} />
      <section className="stats-section" ref={cyclesRef}>
        <h2 className="history-day">Cycles</h2>
        <ul className="history-list">
          {pageOf.items.map((c) => (
            <CycleCard key={c.id} cycle={c} />
          ))}
        </ul>
        {pageOf.pages > 1 && (
          <nav className="pager" aria-label="Cycles pages">
            <button
              type="button"
              className="plover-btn-text"
              disabled={pageOf.page === 1}
              onClick={() => goTo(pageOf.page - 1)}
            >
              ← Previous
            </button>
            <span className="history-meta" aria-live="polite">
              {`Page ${pageOf.page} of ${pageOf.pages}`}
            </span>
            <button
              type="button"
              className="plover-btn-text"
              disabled={pageOf.page === pageOf.pages}
              onClick={() => goTo(pageOf.page + 1)}
            >
              Next →
            </button>
          </nav>
        )}
      </section>
    </>
  );
}

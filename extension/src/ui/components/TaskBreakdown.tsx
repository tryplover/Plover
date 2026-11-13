import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { conflictDuring } from "@/features/calendar/events";
import { limitNotice } from "@/features/tasks/decompose";
import { insertStepAfter } from "@/features/tasks/draft-steps";
import { sendCommand } from "@/shared/messages";
import type { CalendarEvent, Task } from "@/shared/types";
import { ConflictOffer } from "@/ui/components/CalendarNext";

interface DraftStep {
  key: string;
  title: string;
}

const newKey = () => crypto.randomUUID();

export function TaskBreakdown({
  events,
  workMinutes,
  now,
  autoFocus = false,
}: {
  events: CalendarEvent[];
  workMinutes: number;
  now: number;
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<DraftStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState<CalendarEvent | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const stepRefs = useRef(new Map<string, HTMLInputElement>());
  const focusKey = useRef<string | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const active = document.activeElement;
    if (!active || active === document.body) titleRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (focusKey.current === null) return;
    stepRefs.current.get(focusKey.current)?.focus();
    focusKey.current = null;
  }, [steps]);

  function addStepAfter(index: number) {
    const step = { key: newKey(), title: "" };
    focusKey.current = step.key;
    setSteps((cur) => insertStepAfter(cur ?? [], index, step));
  }

  function writeOwn() {
    const step = { key: newKey(), title: "" };
    focusKey.current = step.key;
    setSteps([step]);
  }

  function onStepKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (
      e.key !== "Enter" ||
      e.ctrlKey ||
      e.metaKey ||
      e.nativeEvent.isComposing
    )
      return;
    e.preventDefault();
    const isLast = i === (steps?.length ?? 0) - 1;
    if (isLast && e.currentTarget.value.trim() === "") return;
    addStepAfter(i);
  }

  function onStepsKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (!busy && title.trim()) void start();
  }

  function onTitleSubmit(e: FormEvent) {
    e.preventDefault();
    if (steps === null && !busy) void suggest();
  }

  function onStepsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busy && title.trim()) void start();
  }

  async function suggest() {
    const text = title.trim();
    if (!text) return;
    setBusy(true);
    setNotice(null);
    const res = await sendCommand({ type: "task/decompose", text });
    setBusy(false);
    const data = res.ok
      ? (res.data as
          | { steps?: string[]; aiFailed?: boolean; limitedFor?: number }
          | undefined)
      : undefined;
    const suggested = data?.steps ?? [];
    setSteps(suggested.map((t) => ({ key: newKey(), title: t })));
    if (data?.limitedFor !== undefined) {
      setNotice(limitNotice(data.limitedFor));
    } else if (!res.ok || data?.aiFailed || suggested.length === 0) {
      setNotice("Couldn't suggest steps. Write your own below.");
    }
  }

  function update(i: number, patch: Partial<DraftStep>) {
    setSteps((cur) =>
      (cur ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  function move(i: number, delta: number) {
    setSteps((cur) => {
      const next = [...(cur ?? [])];
      const j = i + delta;
      const a = next[i];
      const b = next[j];
      if (!a || !b) return next;
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  function buildTask(text: string, draft: DraftStep[]): Task {
    return {
      id: newKey(),
      title: text,
      steps: draft
        .map((s) => s.title.trim())
        .filter((t) => t.length > 0)
        .map((t) => ({ id: newKey(), title: t, done: false })),
      createdAt: Date.now(),
      doneAt: null,
    };
  }

  async function addToList() {
    const text = title.trim();
    if (!text || !steps) return;
    setConflict(null);
    setBusy(true);
    setNotice(null);
    const saved = await sendCommand({
      type: "task/save",
      task: buildTask(text, steps),
    });
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.error);
      return;
    }
    setTitle("");
    setSteps(null);
    titleRef.current?.focus();
  }

  async function start(endBy?: number, checked = false) {
    const text = title.trim();
    if (!text || !steps) return;
    if (!checked) {
      const now = Date.now();
      const clash = conflictDuring(events, now, now + workMinutes * 60_000);
      if (clash) {
        setConflict(clash);
        return;
      }
    }
    setConflict(null);
    const task = buildTask(text, steps);
    setBusy(true);
    setNotice(null);
    const saved = await sendCommand({ type: "task/save", task });
    const active = saved.ok
      ? await sendCommand({ type: "task/setActive", taskId: task.id })
      : saved;
    const started = active.ok
      ? await sendCommand({ type: "timer/start", endBy })
      : active;
    setBusy(false);
    if (!started.ok) setNotice(started.error);
  }

  return (
    <div className="plover-breakdown">
      <label htmlFor="plover-task-title" className="plover-heading">
        What are you working on?
      </label>
      <form onSubmit={onTitleSubmit}>
        <input
          ref={titleRef}
          id="plover-task-title"
          type="text"
          placeholder="e.g. Write the intro of my essay"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {steps === null && (
          <div className="plover-row">
            <button
              type="submit"
              className="plover-btn-compact"
              disabled={busy || !title.trim()}
            >
              {busy ? "Thinking..." : "Suggest steps"}
            </button>
            <button
              type="button"
              className="plover-btn-text"
              disabled={busy || !title.trim()}
              onClick={writeOwn}
            >
              Write my own
            </button>
          </div>
        )}
      </form>
      {steps !== null && (
        <form onSubmit={onStepsSubmit} onKeyDown={onStepsKeyDown}>
          <ul className="plover-steps">
            {steps.map((s, i) => (
              <li key={s.key} className="plover-task-row">
                <input
                  ref={(el) => {
                    if (el) stepRefs.current.set(s.key, el);
                    else stepRefs.current.delete(s.key);
                  }}
                  type="text"
                  aria-label={`Step ${i + 1}`}
                  value={s.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  onKeyDown={(e) => onStepKeyDown(e, i)}
                />
                <button
                  type="button"
                  className="plover-btn-text plover-icon-btn"
                  aria-label={`Move step ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="plover-btn-text plover-icon-btn"
                  aria-label={`Move step ${i + 1} down`}
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="plover-btn-text plover-icon-btn"
                  aria-label={`Delete step ${i + 1}: ${s.title.trim() || "empty"}`}
                  onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="plover-row">
            <button
              type="button"
              className="plover-btn-text"
              onClick={() => addStepAfter(steps.length - 1)}
            >
              Add step
            </button>
            <button
              type="button"
              className="plover-btn-text"
              disabled={busy || !title.trim()}
              onClick={() => void addToList()}
            >
              Add to list
            </button>
            <button
              type="submit"
              className="plover-btn-brand"
              disabled={busy || !title.trim()}
            >
              Start
            </button>
          </div>
        </form>
      )}
      {conflict && (
        <ConflictOffer
          event={conflict}
          now={now}
          onShorten={(endBy) => void start(endBy, true)}
          onAnyway={() => void start(undefined, true)}
        />
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

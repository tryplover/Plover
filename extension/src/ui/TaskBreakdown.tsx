import { useState } from "react";
import { sendCommand } from "@/lib/messages";
import type { Task } from "@/lib/types";

interface DraftStep {
  key: string;
  title: string;
}

const newKey = () => crypto.randomUUID();

export function TaskBreakdown() {
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<DraftStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function suggest() {
    const text = title.trim();
    if (!text) return;
    setBusy(true);
    setNotice(null);
    const res = await sendCommand({ type: "task/decompose", text });
    setBusy(false);
    const data = res.ok
      ? (res.data as { steps?: string[]; aiFailed?: boolean } | undefined)
      : undefined;
    const suggested = data?.steps ?? [];
    setSteps(suggested.map((t) => ({ key: newKey(), title: t })));
    if (!res.ok || data?.aiFailed || suggested.length === 0) {
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

  async function start() {
    const text = title.trim();
    if (!text || !steps) return;
    const task: Task = {
      id: newKey(),
      title: text,
      steps: steps
        .map((s) => s.title.trim())
        .filter((t) => t.length > 0)
        .map((t) => ({ id: newKey(), title: t, done: false })),
      createdAt: Date.now(),
      doneAt: null,
    };
    setBusy(true);
    setNotice(null);
    const saved = await sendCommand({ type: "task/save", task });
    const active = saved.ok
      ? await sendCommand({ type: "task/setActive", taskId: task.id })
      : saved;
    const started = active.ok
      ? await sendCommand({ type: "timer/start" })
      : active;
    setBusy(false);
    if (!started.ok) setNotice(started.error);
  }

  return (
    <div className="plover-breakdown">
      <input
        type="text"
        placeholder="What are you working on?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {steps === null ? (
        <div className="plover-row">
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void suggest()}
          >
            {busy ? "Thinking..." : "Suggest steps"}
          </button>
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => setSteps([])}
          >
            Write my own
          </button>
        </div>
      ) : (
        <>
          <ul className="plover-steps">
            {steps.map((s, i) => (
              <li key={s.key}>
                <input
                  type="text"
                  aria-label={`Step ${i + 1}`}
                  value={s.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Delete step"
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
              onClick={() => setSteps([...steps, { key: newKey(), title: "" }])}
            >
              Add step
            </button>
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void start()}
            >
              Start
            </button>
          </div>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

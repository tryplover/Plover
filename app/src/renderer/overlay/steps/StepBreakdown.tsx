import { useEffect, useState } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import { StepRow } from '../../components/StepRow';
import { Button } from '../../components/Button';
import type { ProposedPlan } from '../../../preload';
import './StepBreakdown.css';

interface Props {
  draft: { text: string; frequency: 'one-off' | 'daily' | 'weekly' };
  onBack: () => void;
  onNext: (plan: ProposedPlan) => void;
  variant: 'overlay' | 'window';
}

export function StepBreakdown({ draft, onBack, onNext, variant }: Props) {
  const [plan, setPlan] = useState<ProposedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.api.proposeGoal(draft.text);
        if (!cancelled) setPlan(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.text]);

  if (loading) return <p className="plover-step-breakdown__loading">Asking Gemini…</p>;
  if (error || !plan) return <p className="plover-step-breakdown__error">{error ?? 'No plan'}</p>;

  const addStep = () => {
    setPlan((p) =>
      p ? { ...p, subtasks: [...p.subtasks, { title: 'New step', estimate_minutes: 30 }] } : p,
    );
  };

  return (
    <section className={`plover-step-breakdown plover-step-breakdown--${variant}`}>
      <StatusIndicator kind="observing" label={`Gemini suggested ${plan.subtasks.length} steps`} />
      <h2>{plan.goal.title}</h2>
      <ol className="plover-step-breakdown__list">
        {plan.subtasks.map((_s, i) => {
          const item = plan.subtasks[i];
          if (!item) return null;
          return (
            <li key={i}>
              <StepRow
                index={i + 1}
                label={item.title}
                state="pending"
                onChange={(newTitle) => {
                  setPlan((p) => {
                    if (!p) return p;
                    const newSubtasks = [...p.subtasks];
                    const existing = newSubtasks[i];
                    if (existing) {
                      newSubtasks[i] = { ...existing, title: newTitle };
                    }
                    return { ...p, subtasks: newSubtasks };
                  });
                }}
                trailing={
                  <span className="plover-drag-handle" aria-hidden>
                    ⋮⋮
                  </span>
                }
              />
            </li>
          );
        })}
      </ol>
      <button className="plover-step-breakdown__add" onClick={addStep}>
        + Add a step
      </button>
      <footer>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={() => onNext(plan)}>
          Looks right →
        </Button>
      </footer>
    </section>
  );
}

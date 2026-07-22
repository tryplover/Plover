import { useEffect, useState } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import { StepRow } from '../../components/StepRow';
import { Button } from '../../components/Button';
import { Reorder, useDragControls } from '../../lib/motion';
import type { ProposedPlan } from '../../../preload';
import './StepBreakdown.css';

interface Props {
  draft: { text: string; frequency: 'one-off' | 'daily' | 'weekly' };
  plan?: ProposedPlan | null;
  onBack: () => void;
  onNext: (plan: ProposedPlan) => void;
  variant: 'overlay' | 'window';
}

interface EditableSubtask {
  id: string;
  title: string;
  estimate_minutes: number;
  depends_on?: string[];
  scheduled_start?: string;
  scheduled_end?: string;
}

export function StepBreakdown({ draft, plan, onBack, onNext, variant }: Props) {
  const [goalTitle, setGoalTitle] = useState<string>(() => plan?.goal.title || '');
  const [subtasks, setSubtasks] = useState<EditableSubtask[]>(() => {
    if (plan) {
      return plan.subtasks.map((st, idx) => ({
        ...st,
        id: (st as { id?: string }).id || `step-${idx}-${Date.now()}`,
      }));
    }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !plan);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (plan) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await window.api.proposeGoal(draft.text);
        if (!cancelled) {
          setGoalTitle(result.goal.title);
          setSubtasks(
            result.subtasks.map((st, idx) => ({
              ...st,
              id: (st as { id?: string }).id || `step-${idx}-${Date.now()}`,
            })),
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.text, plan]);

  if (loading) return <p className="plover-step-breakdown__loading">Plover is planning…</p>;
  if (error) return <p className="plover-step-breakdown__error">{error}</p>;

  const addStep = () => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `step-${Date.now()}-${Math.random()}`;
    const newSubtask: EditableSubtask = {
      id: newId,
      title: '',
      estimate_minutes: 30,
    };
    setSubtasks((prev) => [...prev, newSubtask]);
    setNewlyAddedId(newId);
  };

  const updateTitle = (id: string, newTitle: string) => {
    setSubtasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item)),
    );
  };

  const deleteStep = (id: string) => {
    setSubtasks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleNext = () => {
    const cleanedSubtasks = subtasks.map((st) => ({
      title: st.title.trim() || 'Untitled step',
      estimate_minutes: st.estimate_minutes,
      ...(st.depends_on ? { depends_on: st.depends_on } : {}),
      ...(st.scheduled_start ? { scheduled_start: st.scheduled_start } : {}),
      ...(st.scheduled_end ? { scheduled_end: st.scheduled_end } : {}),
    }));
    onNext({
      goal: { title: goalTitle || draft.text },
      subtasks: cleanedSubtasks,
    });
  };

  return (
    <section className={`plover-step-breakdown plover-step-breakdown--${variant}`}>
      <StatusIndicator
        kind="observing"
        label={`Plover suggested ${subtasks.length} step${subtasks.length === 1 ? '' : 's'}`}
      />
      <h2>{goalTitle || draft.text}</h2>

      <Reorder.Group
        axis="y"
        values={subtasks}
        onReorder={setSubtasks}
        as="ol"
        className="plover-step-breakdown__list"
      >
        {subtasks.map((item, i) => (
          <ReorderableStepItem
            key={item.id}
            item={item}
            index={i}
            autoFocus={item.id === newlyAddedId}
            onUpdateTitle={(newTitle) => updateTitle(item.id, newTitle)}
            onDelete={() => deleteStep(item.id)}
          />
        ))}
      </Reorder.Group>

      <button className="plover-step-breakdown__add" onClick={addStep} type="button">
        + Add a step
      </button>
      <footer>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={handleNext}>
          Looks right →
        </Button>
      </footer>
    </section>
  );
}

function ReorderableStepItem({
  item,
  index,
  autoFocus,
  onUpdateTitle,
  onDelete,
}: {
  item: EditableSubtask;
  index: number;
  autoFocus: boolean;
  onUpdateTitle: (newTitle: string) => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      as="li"
      dragListener={false}
      dragControls={dragControls}
      className="plover-step-breakdown__item"
    >
      <StepRow
        index={index + 1}
        label={item.title}
        state="pending"
        onChangeLabel={onUpdateTitle}
        onDelete={onDelete}
        autoFocus={autoFocus}
        dragHandleProps={{
          onPointerDown: (e) => dragControls.start(e),
        }}
      />
    </Reorder.Item>
  );
}

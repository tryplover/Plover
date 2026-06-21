import React, { useState, useEffect, useCallback } from 'react';
import { Goal, Task } from '../../../shared/types';
import { StepRow } from '../../components/StepRow';
import { ProgressLine } from '../../components/ProgressLine';
import { Button } from '../../components/Button';

interface PreviewSubtask {
  id: string;
  title: string;
  estimate_minutes: number;
  depends_on?: string[];
}

export default function GoalsList() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Goal Form State
  const [goalText, setGoalText] = useState('');
  const [decomposing, setDecomposing] = useState(false);

  // Decomposition Preview State
  const [decomposedGoal, setDecomposedGoal] = useState<Omit<
    Goal,
    'id' | 'created_at' | 'updated_at' | 'status'
  > | null>(null);
  const [previewSubtasks, setPreviewSubtasks] = useState<PreviewSubtask[]>([]);
  const [scheduledSlots, setScheduledSlots] = useState<
    { taskId: string; start: string; end: string }[]
  >([]);

  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const allGoals = await window.api.getGoals();
      const allTasks = await window.api.getTasks();
      setGoals(allGoals);
      setTasks(allTasks);

      // Auto expand the first goal if present
      if (allGoals.length > 0) {
        const firstGoal = allGoals[0];
        if (firstGoal) {
          setExpandedGoals((prev) => {
            if (Object.keys(prev).length === 0) {
              return { [firstGoal.id]: true };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load goals & tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as { type: string };
      if (
        appEvent.type === 'goal.created' ||
        appEvent.type === 'task.completed' ||
        appEvent.type === 'task.scheduled'
      ) {
        void fetchData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  const runSchedulePreview = async (currentSubtasks: PreviewSubtask[]) => {
    try {
      const settings = await window.api.getSettings();
      const existingTasks = await window.api.getTasks();
      const existingSlots = existingTasks
        .filter((t) => t.status === 'scheduled' && t.scheduled_start && t.scheduled_end)
        .map((t) => ({
          id: t.id,
          summary: t.title,
          start: t.scheduled_start ?? '',
          end: t.scheduled_end ?? '',
        }));

      const slots = await window.api.scheduleTasks(
        currentSubtasks,
        existingSlots,
        settings.workingHours,
        settings.horizonDays,
      );
      setScheduledSlots(slots);
    } catch (err) {
      console.error('Failed to run schedule preview:', err);
    }
  };

  const handleDecompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim()) return;

    setDecomposing(true);
    setFormError(null);
    try {
      const result = await window.api.decomposeGoal(goalText);
      setDecomposedGoal(result.goal);

      const mappedSubtasks = result.subtasks.map((task, idx) => ({
        ...task,
        id: `temp-preview-task-${idx}`,
      }));
      setPreviewSubtasks(mappedSubtasks);

      await runSchedulePreview(mappedSubtasks);
    } catch (err) {
      console.error('Decomposition failed:', err);
      setFormError('Decomposition failed. Please make sure the backend is active.');
    } finally {
      setDecomposing(false);
    }
  };

  const handleCommitGoal = async () => {
    if (!decomposedGoal) return;
    setFormError(null);
    try {
      const slotsForSave = previewSubtasks.map((task, idx) => {
        const slot = scheduledSlots.find((s) => s.taskId === task.id);
        return {
          tempIndex: idx,
          start: slot?.start || '',
          end: slot?.end || '',
        };
      });

      await window.api.saveGoalAndTasks(decomposedGoal, previewSubtasks, slotsForSave);

      setGoalText('');
      setDecomposedGoal(null);
      setPreviewSubtasks([]);
      setScheduledSlots([]);

      await fetchData();
    } catch (err) {
      console.error('Failed to commit goal:', err);
      setFormError('Failed to save and schedule goal.');
    }
  };

  const handleCancelPreview = () => {
    setDecomposedGoal(null);
    setPreviewSubtasks([]);
    setScheduledSlots([]);
  };

  const toggleExpandGoal = (goalId: string) => {
    setExpandedGoals((prev) => ({
      ...prev,
      [goalId]: !prev[goalId],
    }));
  };

  const handleSubtaskStatusToggle = async (taskId: string, currentStatus: Task['status']) => {
    try {
      const newStatus = currentStatus === 'done' ? 'scheduled' : 'done';
      await window.api.updateTaskStatus(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t,
        ),
      );
    } catch (err) {
      console.error('Failed to update subtask status:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingTop: '40px',
        paddingBottom: '40px',
        paddingLeft: '40px',
        paddingRight: '40px',
        backgroundColor: 'var(--plover-bg)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--plover-font-serif)',
          fontSize: '36px',
          fontWeight: 400,
          marginBottom: '28px',
          color: 'var(--plover-text)',
        }}
      >
        Goals
      </h1>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!decomposedGoal && (
          <div style={{ marginBottom: '32px' }}>
            <form onSubmit={handleDecompose} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="What are you working on?"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                disabled={decomposing}
                style={{
                  backgroundColor: 'var(--plover-surface)',
                  border: '1px solid var(--plover-border)',
                  borderRadius: 'var(--plover-radius-md)',
                  padding: '12px 16px',
                  color: 'var(--plover-text)',
                  fontSize: '15px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--plover-mint)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--plover-border)';
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={decomposing || !goalText.trim()}
                >
                  {decomposing ? 'Decomposing...' : 'Break into steps →'}
                </Button>
              </div>
              {formError && (
                <div role="alert" style={{ color: '#ff5d5d', fontSize: '13px' }}>
                  {formError}
                </div>
              )}
            </form>
          </div>
        )}

        {decomposedGoal && (
          <div
            style={{
              backgroundColor: 'var(--plover-surface)',
              borderRadius: 'var(--plover-radius-lg)',
              padding: '24px',
              marginBottom: '32px',
              border: `1px solid var(--plover-mint)`,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--plover-mint)' }}>PREVIEW</span>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>
                  {decomposedGoal.title}
                </h2>
              </div>
              <Button variant="secondary" onClick={handleCancelPreview}>
                Cancel
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {previewSubtasks.map((subtask) => (
                <StepRow
                  key={subtask.id}
                  label={subtask.title}
                  state="pending"
                  trailing={`${subtask.estimate_minutes}m`}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={handleCommitGoal}>
                Save Goal
              </Button>
            </div>
            {formError && (
              <div role="alert" style={{ marginTop: '8px', color: '#ff5d5d', fontSize: '13px' }}>
                {formError}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--plover-text-muted)' }}>
              <p>No active goals found.</p>
            </div>
          ) : (
            goals.map((goal) => {
              const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
              const doneTasks = goalTasks.filter((t) => t.status === 'done');
              const progressValue = goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
              const isOpen = !!expandedGoals[goal.id];

              return (
                <div
                  key={goal.id}
                  style={{
                    backgroundColor: 'var(--plover-surface)',
                    borderRadius: 'var(--plover-radius-lg)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => toggleExpandGoal(goal.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '24px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--plover-text)' }}>
                        {goal.title}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <ProgressLine value={progressValue} />
                      <span
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s',
                          display: 'inline-block',
                          color: 'var(--plover-text-muted)',
                        }}
                      >
                        ▾
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 24px 24px 24px', borderTop: `1px solid var(--plover-border)` }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {goalTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => handleSubtaskStatusToggle(task.id, task.status)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          >
                            <StepRow
                              label={task.title}
                              state={task.status === 'done' ? 'done' : 'pending'}
                              trailing={`${task.estimate_minutes}m`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

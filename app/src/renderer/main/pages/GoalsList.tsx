import React, { useState, useEffect, useCallback } from 'react';
import { Goal, Task } from '../../../shared/types';

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

  const handlePreviewSubtaskChange = async (
    index: number,
    field: 'title' | 'estimate_minutes',
    value: string | number,
  ) => {
    const updated = [...previewSubtasks];
    const task = updated[index];
    if (!task) return;

    if (field === 'title') {
      task.title = value as string;
    } else if (field === 'estimate_minutes') {
      task.estimate_minutes = Math.max(15, Number(value));
    }
    setPreviewSubtasks(updated);

    await runSchedulePreview(updated);
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
      <div className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div
          className="loading-spinner"
          style={{ borderTopColor: 'var(--accent-color)', width: '32px', height: '32px' }}
        />
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <span className="page-subtitle">Strategic Planning</span>
        <h1 className="page-title">Goals & Subtasks</h1>
      </div>

      {!decomposedGoal && (
        <form onSubmit={handleDecompose} className="card">
          <div className="goal-input-container">
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Capture a New Goal</h3>
            <textarea
              className="goal-textarea"
              placeholder="e.g. Finish the GPU profiler write-up by Friday, ~4 hrs of work..."
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              disabled={decomposing}
            />
          </div>
          <button
            type="submit"
            className="goal-submit-button"
            disabled={decomposing || !goalText.trim()}
          >
            {decomposing ? (
              <>
                <div className="loading-spinner" /> Decomposing Goal...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Plan Goal
              </>
            )}
          </button>
          {formError && (
            <div role="alert" style={{ marginTop: '8px', color: '#ff5d5d', fontSize: '13px' }}>
              {formError}
            </div>
          )}
        </form>
      )}

      {decomposedGoal && (
        <div className="card preview-card">
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: 'var(--accent-color)',
                  letterSpacing: '0.05em',
                }}
              >
                Decomposed Goal Preview
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px' }}>
                {decomposedGoal.title}
              </h2>
            </div>
            <button className="btn btn-danger" onClick={handleCancelPreview}>
              Cancel
            </button>
          </div>

          <div style={{ marginTop: '12px' }}>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              Refine Subtasks & Durations
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {previewSubtasks.map((subtask, index) => {
                const slot = scheduledSlots.find((s) => s.taskId === subtask.id);
                const timeString = slot
                  ? new Date(slot.start).toLocaleString([], {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Unscheduled';

                return (
                  <div key={subtask.id} className="preview-subtask-item">
                    <div className="preview-inputs">
                      <span
                        style={{ fontSize: '13px', color: 'var(--text-tertiary)', width: '20px' }}
                      >
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        className="preview-title-input"
                        value={subtask.title}
                        onChange={(e) => handlePreviewSubtaskChange(index, 'title', e.target.value)}
                      />
                      <input
                        type="number"
                        className="preview-duration-input"
                        value={subtask.estimate_minutes}
                        onChange={(e) =>
                          handlePreviewSubtaskChange(index, 'estimate_minutes', e.target.value)
                        }
                      />
                      <span className="preview-duration-unit">min</span>
                    </div>
                    <span
                      style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: '500' }}
                    >
                      {timeString}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="preview-actions">
            <button className="btn btn-primary" onClick={handleCommitGoal}>
              Accept & Schedule Tasks
            </button>
          </div>
          {formError && (
            <div role="alert" style={{ marginTop: '8px', color: '#ff5d5d', fontSize: '13px' }}>
              {formError}
            </div>
          )}
        </div>
      )}

      <div className="goals-list">
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Active Goals</h2>

        {goals.length === 0 ? (
          <div className="card" style={{ alignItems: 'center', padding: '36px', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              No active goals found.
            </span>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center' }}>
              Type a goal in the form above to start scheduling subtasks automatically.
            </p>
          </div>
        ) : (
          goals.map((goal) => {
            const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
            const doneTasks = goalTasks.filter((t) => t.status === 'done');
            const progressPercent =
              goalTasks.length > 0 ? Math.round((doneTasks.length / goalTasks.length) * 100) : 0;
            const isOpen = !!expandedGoals[goal.id];

            return (
              <div key={goal.id} className="goal-card">
                <div className="goal-card-header" onClick={() => toggleExpandGoal(goal.id)}>
                  <div className="goal-header-left">
                    <h3 className="goal-card-title">{goal.title}</h3>
                    <div className="goal-meta">
                      {goal.deadline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📅 Deadline: {goal.deadline}
                        </span>
                      )}
                      <span>🎯 {goalTasks.length} subtasks</span>
                    </div>
                  </div>

                  <div className="goal-progress-container">
                    <div className="goal-progress-bar">
                      <div
                        className="goal-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="goal-progress-text">
                      {doneTasks.length} / {goalTasks.length} Done
                    </span>
                  </div>

                  <svg
                    className={`chevron-icon ${isOpen ? 'open' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {isOpen && (
                  <div className="goal-card-body">
                    {goal.description && <p className="goal-description">{goal.description}</p>}

                    <div className="subtasks-list">
                      {goalTasks.map((task) => {
                        const isDone = task.status === 'done';
                        const timeStr = task.scheduled_start
                          ? new Date(task.scheduled_start).toLocaleString([], {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Unscheduled';

                        return (
                          <div key={task.id} className={`subtask-item ${isDone ? 'done' : ''}`}>
                            <div className="subtask-left">
                              <button
                                className={`circle-check-button ${isDone ? 'done' : ''}`}
                                onClick={() => handleSubtaskStatusToggle(task.id, task.status)}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  border: '1.5px solid var(--text-tertiary)',
                                }}
                              >
                                {isDone ? '✓' : ''}
                              </button>
                              <span className="subtask-title">{task.title}</span>
                            </div>
                            <div className="subtask-right">
                              <span>⏱️ {task.estimate_minutes}m</span>
                              <span
                                style={{
                                  color: task.scheduled_start
                                    ? 'var(--accent-color)'
                                    : 'var(--text-tertiary)',
                                }}
                              >
                                {timeStr}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

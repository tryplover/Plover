import { useState, useEffect, useCallback, useMemo } from 'react';
import { Goal, Task } from '../../../../shared/types';
import { pickCurrentTask, sortByScheduledStart } from '../../../../shared/current-task';
import { StepRow } from '../../../components/StepRow/StepRow';
import { ProgressLine } from '../../../components/ProgressLine/ProgressLine';
import { Button } from '../../../components/Button/Button';
import { SetupFlow } from '../../../overlay/SetupFlow/SetupFlow';
import { useAppEvents } from '../../../hooks/useAppEvents';
import { useProgressPops } from '../../../hooks/useProgressPops';
import { PercentPop } from '../../../components/PercentPop/PercentPop';
import './Home.css';

interface HomeProps {
  'data-testid'?: string;
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function Home({ 'data-testid': dataTestId }: HomeProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [progressPopsEnabled, setProgressPopsEnabled] = useState(false);

  const tasksByGoal = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      const list = map[task.goal_id];
      if (list) {
        list.push(task);
      } else {
        map[task.goal_id] = [task];
      }
    }
    return map;
  }, [tasks]);

  const fetchData = useCallback(async () => {
    try {
      const [allGoals, allTasks, settings] = await Promise.all([
        window.api.getGoals(),
        window.api.getTasks(),
        window.api.getSettings(),
      ]);
      setGoals(allGoals);
      setTasks(allTasks);
      setProgressPopsEnabled(settings.progressPopsEnabled ?? false);
    } catch (err) {
      console.error('Failed to load goals & tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  useAppEvents(() => {
    void fetchData();
  });

  // Predicts (from current, pre-update state) whether completing `excludeTaskId`
  // would leave no other pending task in its goal — checked before the status
  // update so callers aren't reading stale closure state after `fetchData()`.
  const isLastPendingTask = useCallback(
    (goalId: string, excludeTaskId: string) => {
      const goalTasks = tasksByGoal[goalId] ?? [];
      return !goalTasks.some(
        (t) => t.id !== excludeTaskId && t.status !== 'done' && t.status !== 'skipped',
      );
    },
    [tasksByGoal],
  );

  const confirmAndDeleteGoal = useCallback(
    async (goal: Goal) => {
      if (!confirm(`"${goal.title}" looks complete. Delete it?`)) return;
      try {
        await window.api.deleteGoal(goal.id);
        if (expandedGoalId === goal.id) setExpandedGoalId(null);
        await fetchData();
      } catch (err) {
        console.error('Failed to delete completed goal:', err);
      }
    },
    [expandedGoalId, fetchData],
  );

  const selectAsActiveTask = useCallback(
    async (taskId: string) => {
      const others = tasks.filter((t) => t.status === 'in_progress' && t.id !== taskId);
      try {
        await Promise.all(
          others.map((t) =>
            window.api.updateTaskStatus(t.id, t.scheduled_start ? 'scheduled' : 'todo'),
          ),
        );
        await window.api.updateTaskStatus(taskId, 'in_progress');
        await fetchData();
      } catch (err) {
        console.error('Failed to set active task:', err);
      }
    },
    [tasks, fetchData],
  );

  const toggleTaskDone = useCallback(
    async (task: Task) => {
      const completingTask = task.status !== 'done';
      const willFinishGoal = completingTask && isLastPendingTask(task.goal_id, task.id);
      try {
        const nextStatus =
          task.status === 'done' ? (task.scheduled_start ? 'scheduled' : 'todo') : 'done';
        await window.api.updateTaskStatus(task.id, nextStatus);
        await fetchData();
        if (willFinishGoal) {
          const goal = goals.find((g) => g.id === task.goal_id);
          if (goal) await confirmAndDeleteGoal(goal);
        }
      } catch (err) {
        console.error('Failed to toggle task completion:', err);
      }
    },
    [fetchData, isLastPendingTask, goals, confirmAndDeleteGoal],
  );

  const watchGoal = useCallback(
    async (goal: Goal) => {
      const goalTasks = tasksByGoal[goal.id] ?? [];
      const target = pickCurrentTask(goalTasks);
      if (!target) {
        // Every task in this goal is already done/skipped — there's nothing to
        // reactivate. Falling back to an arbitrary already-done task here used
        // to silently un-complete it; offer to clean up the goal instead.
        if (goalTasks.length > 0) await confirmAndDeleteGoal(goal);
        return;
      }
      setExpandedGoalId(goal.id);
      setStepsExpanded(true);
      await selectAsActiveTask(target.id);
    },
    [tasksByGoal, selectAsActiveTask, confirmAndDeleteGoal],
  );

  const defaultCurrentTask = useMemo(() => pickCurrentTask(tasks), [tasks]);
  const defaultActiveGoalId = defaultCurrentTask?.goal_id ?? null;

  const finishActiveTask = useCallback(async () => {
    if (!defaultCurrentTask) return;
    const willFinishGoal = isLastPendingTask(defaultCurrentTask.goal_id, defaultCurrentTask.id);
    try {
      await window.api.updateTaskStatus(defaultCurrentTask.id, 'done');
      await fetchData();
      if (willFinishGoal) {
        const goal = goals.find((g) => g.id === defaultCurrentTask.goal_id);
        if (goal) await confirmAndDeleteGoal(goal);
      }
    } catch (err) {
      console.error('Failed to finish task:', err);
    }
  }, [defaultCurrentTask, fetchData, isLastPendingTask, goals, confirmAndDeleteGoal]);

  const activeGoalId = defaultActiveGoalId;

  const currentTask = useMemo(() => {
    if (expandedGoalId && expandedGoalId === activeGoalId) return defaultCurrentTask;
    return null;
  }, [expandedGoalId, activeGoalId, defaultCurrentTask]);

  const activeTaskId = currentTask?.id ?? null;

  const pops = useProgressPops(activeTaskId, progressPopsEnabled);

  const activeGoalSteps = useMemo(() => {
    if (!expandedGoalId) return [];
    return sortByScheduledStart(tasksByGoal[expandedGoalId] ?? []);
  }, [expandedGoalId, tasksByGoal]);

  // Frequency grouping (One-off / Daily / Weekly headers from the Figma
  // design) is deferred: Goal/Task has no `frequency` field today — the
  // setup flow collects it locally but nothing persists it — so this
  // renders one flat list instead of fabricating section headers.
  const goalCards = useMemo(() => {
    return goals.map((goal) => {
      const goalTasks = tasksByGoal[goal.id] ?? [];
      const doneTasks = goalTasks.filter((t) => t.status === 'done');
      const progress = goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
      return { goal, progress, isActive: goal.id === activeGoalId };
    });
  }, [goals, tasksByGoal, activeGoalId]);

  const inMotionCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped').length,
    [tasks],
  );

  const closestGoal = useMemo(() => {
    let best: { goal: Goal; progress: number } | null = null;
    for (const { goal, progress } of goalCards) {
      if (progress <= 0 || progress >= 1) continue;
      if (!best || progress > best.progress) {
        best = { goal, progress };
      }
    }
    return best?.goal ?? null;
  }, [goalCards]);

  const subtitle = useMemo(() => {
    if (inMotionCount === 0) return 'Nothing in motion right now — start a task to get going.';
    const taskWord = inMotionCount === 1 ? 'task' : 'tasks';
    if (closestGoal) {
      return `${inMotionCount} ${taskWord} in motion today. ${closestGoal.title} is closest to done.`;
    }
    return `${inMotionCount} ${taskWord} in motion today.`;
  }, [inMotionCount, closestGoal]);

  if (loading) {
    return (
      <div data-testid={dataTestId} className="plover-home-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div data-testid={dataTestId} className="plover-home-empty">
        <div className="plover-home-empty__decoy" aria-hidden>
          <div className="plover-home-empty__decoy-row">
            <span className="plover-home-empty__decoy-dot" />
            <span className="plover-home-empty__decoy-bar plover-home-empty__decoy-bar--title" />
            <span className="plover-home-empty__decoy-bar plover-home-empty__decoy-bar--pct" />
          </div>
          <div className="plover-home-empty__decoy-track" />
        </div>
        <h1 className="plover-home-empty__title">A calm place for your work.</h1>
        <p className="plover-home-empty__body">
          No tasks yet. Define one, and Plover fills the bar as you actually do it — no timers, no
          guilt, just real progress.
        </p>
        <Button
          variant="primary"
          className="plover-home-empty__cta"
          onClick={() => setShowSetupModal(true)}
        >
          + Start your first task
        </Button>

        {showSetupModal && (
          <div className="plover-modal-backdrop">
            <div className="plover-modal-content">
              <button
                className="plover-modal-close"
                onClick={() => setShowSetupModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
              <SetupFlow
                variant="window"
                onClose={() => {
                  setShowSetupModal(false);
                  void fetchData();
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid={dataTestId} className="plover-home">
      <h1 className="plover-home__greeting">{greetingForNow()}</h1>
      <p className="plover-home__subtitle">{subtitle}</p>
      <Button
        variant="primary"
        className="plover-home__cta"
        onClick={() => setShowSetupModal(true)}
      >
        + Start a task
      </Button>

      <div className="plover-home__list">
        {goalCards.map(({ goal, progress, isActive }) => (
          <div
            key={goal.id}
            className={`plover-home-card-group ${isActive ? 'plover-home-card-group--active' : ''}`}
          >
            <div
              className={`plover-home-task-row ${isActive ? 'plover-home-task-row--active' : ''}`}
              onClick={(e) => {
                // Clicking (unlike deliberate Tab navigation) shouldn't leave this
                // row visually "in focus" — :focus-within drives the same
                // hover-preview swap as :hover in Home.css, and a row you merely
                // clicked to expand isn't necessarily the active/watched goal.
                (e.currentTarget as HTMLElement).blur();
                if (expandedGoalId === goal.id) {
                  setStepsExpanded((v) => !v);
                } else {
                  setExpandedGoalId(goal.id);
                  setStepsExpanded(true);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="plover-home-task-row__info">
                <div className="plover-home-task-row__title-line">
                  {isActive && <span className="plover-home-dot" aria-hidden />}
                  <span className="plover-home-task-row__title">{goal.title}</span>
                </div>
                {goal.description && (
                  <span className="plover-home-task-row__subtitle">{goal.description}</span>
                )}
              </div>
              <div className="plover-home-task-row__progress">
                <ProgressLine value={progress} />
              </div>
              <span className="plover-home-task-row__pct">{Math.round(progress * 100)}%</span>
              {!isActive && (tasksByGoal[goal.id] ?? []).length > 0 && (
                <button
                  type="button"
                  className="plover-home-task-row__switch"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                    void watchGoal(goal);
                  }}
                  title="Switch to this task"
                  aria-label="Switch to this task"
                >
                  Switch
                </button>
              )}
              {isActive && (
                <button
                  type="button"
                  className="plover-home-task-row__finish"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                    void finishActiveTask();
                  }}
                  title={
                    defaultCurrentTask
                      ? `Finish "${defaultCurrentTask.title}"`
                      : 'Finish current task'
                  }
                  aria-label="Finish current task"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="plover-home-task-row__delete"
                onClick={async (e) => {
                  e.stopPropagation();
                  e.currentTarget.blur();
                  if (
                    confirm(
                      `Are you sure you want to delete the goal "${goal.title}" and all its subtasks?`,
                    )
                  ) {
                    try {
                      await window.api.deleteGoal(goal.id);
                      if (expandedGoalId === goal.id) {
                        setExpandedGoalId(null);
                      }
                      await fetchData();
                    } catch (err) {
                      console.error('Failed to delete goal:', err);
                    }
                  }
                }}
                title="Delete goal"
                aria-label="Delete goal"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>

            {expandedGoalId === goal.id && stepsExpanded && (
              <div className="plover-home-steps-panel">
                <div className="plover-home-steps-list">
                  {activeGoalSteps.length === 0 ? (
                    <p className="plover-home-steps-empty">No subtasks yet for this goal.</p>
                  ) : (
                    activeGoalSteps.map((step) => (
                      <StepRow
                        key={step.id}
                        label={step.title}
                        state={
                          step.status === 'done'
                            ? 'done'
                            : step.id === activeTaskId
                              ? 'current'
                              : 'pending'
                        }
                        trailing={
                          step.id === activeTaskId ? (
                            <span className="plover-home-step-momentum">
                              <span>now</span>
                              <span className="plover-home-step-momentum__pct">
                                {Math.round(step.progress)}%
                              </span>
                              {progressPopsEnabled && <PercentPop pops={pops} />}
                            </span>
                          ) : undefined
                        }
                        onToggleDone={() => void toggleTaskDone(step)}
                        onDelete={async () => {
                          if (
                            confirm(`Are you sure you want to delete the subtask "${step.title}"?`)
                          ) {
                            try {
                              await window.api.deleteTask(step.id);
                              await fetchData();
                            } catch (err) {
                              console.error('Failed to delete subtask:', err);
                            }
                          }
                        }}
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="plover-home-steps-toggle"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setStepsExpanded(false);
                  }}
                >
                  Hide steps ⌃
                </button>
                <p className="plover-home-steps-caption">
                  Only this window is watched — nothing is saved.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {showSetupModal && (
        <div className="plover-modal-backdrop">
          <button
            className="plover-modal-backdrop-close"
            onClick={() => setShowSetupModal(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
          <div className="plover-modal-content">
            <SetupFlow
              variant="window"
              onClose={() => {
                setShowSetupModal(false);
                void fetchData();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

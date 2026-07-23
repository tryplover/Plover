import { useState, useEffect, useCallback, useMemo } from 'react';
import { Goal, Task } from '../../../shared/types';
import { StepRow } from '../../components/StepRow';
import { ProgressLine } from '../../components/ProgressLine';
import { Button } from '../../components/Button';
import { SetupFlow } from '../../overlay/SetupFlow';
import { useAppEvents } from '../../hooks/useAppEvents';
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

function sortSiblings(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aStart = a.scheduled_start;
    const bStart = b.scheduled_start;
    if (!aStart && !bStart) return a.id.localeCompare(b.id);
    if (!aStart) return 1;
    if (!bStart) return -1;
    if (aStart !== bStart) return aStart.localeCompare(bStart);
    return a.id.localeCompare(b.id);
  });
}

// "Main task at hand" = the task Plover should be watching right now: not
// done/skipped, ranked in_progress > scheduled > todo, tie-broken the same
// way sortSiblings orders a goal's own steps. There's no real activity
// monitoring yet (Phase 2+), so `in_progress` is rarely set by anything
// today — this mostly resolves to "earliest scheduled/todo task" in
// practice, which is still a real, non-fabricated signal.
const TASK_STATUS_RANK: Record<Task['status'], number> = {
  in_progress: 0,
  scheduled: 1,
  todo: 2,
  done: 3,
  skipped: 3,
};

function pickCurrentTask(tasks: Task[]): Task | null {
  const candidates = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const [first] = sortSiblings(candidates).sort(
    (a, b) => TASK_STATUS_RANK[a.status] - TASK_STATUS_RANK[b.status],
  );
  return first ?? null;
}

export default function Home({ 'data-testid': dataTestId }: HomeProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

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
      const [allGoals, allTasks] = await Promise.all([
        window.api.getGoals(),
        window.api.getTasks(),
      ]);
      setGoals(allGoals);
      setTasks(allTasks);
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

  const currentTask = useMemo(() => pickCurrentTask(tasks), [tasks]);
  const activeTaskId = currentTask?.id ?? null;
  const activeGoalId = currentTask?.goal_id ?? null;

  const activeGoalSteps = useMemo(() => {
    if (!activeGoalId) return [];
    return sortSiblings(tasksByGoal[activeGoalId] ?? []);
  }, [activeGoalId, tasksByGoal]);

  // Frequency grouping (One-off / Daily / Weekly headers from the Figma
  // design) is deferred: Goal/Task has no `frequency` field today — the
  // setup flow collects it locally but nothing persists it — so this
  // renders one flat list instead of fabricating section headers.
  const goalCards = useMemo(() => {
    return goals.map((goal) => {
      const goalTasks = tasksByGoal[goal.id] ?? [];
      const totalProgress = goalTasks.reduce(
        (sum, t) => sum + (t.status === 'done' ? 100 : t.progress),
        0,
      );
      const progress = goalTasks.length > 0 ? totalProgress / (goalTasks.length * 100) : 0;
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
          <div className="plover-modal-backdrop" onClick={() => setShowSetupModal(false)}>
            <div className="plover-modal-content" onClick={(e) => e.stopPropagation()}>
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
          <div key={goal.id} className="plover-home-card-group">
            <div
              className={`plover-home-task-row ${isActive ? 'plover-home-task-row--active' : ''}`}
              onClick={isActive ? () => setStepsExpanded((v) => !v) : undefined}
              role={isActive ? 'button' : undefined}
              tabIndex={isActive ? 0 : undefined}
            >
              <div className="plover-home-task-row__info">
                <div className="plover-home-task-row__title-line">
                  {isActive && <span className="plover-home-dot" aria-hidden />}
                  <span className="plover-home-task-row__title">{goal.title}</span>
                  {isActive && <span className="plover-home-task-row__watching">WATCHING NOW</span>}
                </div>
                {goal.description && (
                  <span className="plover-home-task-row__subtitle">{goal.description}</span>
                )}
              </div>
              <div className="plover-home-task-row__progress">
                <ProgressLine value={progress} />
              </div>
              <span className="plover-home-task-row__pct">{Math.round(progress * 100)}%</span>
            </div>

            {isActive && stepsExpanded && (
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
                            step.progress > 0 ? (
                              <span>{step.progress}% • now</span>
                            ) : (
                              'now'
                            )
                          ) : step.progress > 0 && step.status !== 'done' ? (
                            <span>{step.progress}%</span>
                          ) : undefined
                        }
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="plover-home-steps-toggle"
                  onClick={() => setStepsExpanded(false)}
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
        <div className="plover-modal-backdrop" onClick={() => setShowSetupModal(false)}>
          <button
            className="plover-modal-backdrop-close"
            onClick={() => setShowSetupModal(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
          <div className="plover-modal-content" onClick={(e) => e.stopPropagation()}>
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

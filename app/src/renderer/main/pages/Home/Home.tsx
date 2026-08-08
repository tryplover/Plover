import { useState, useCallback, useMemo } from 'react';
import { Goal, Task } from '../../../../shared/types';
import { pickCurrentTask, sortByScheduledStart } from '../../../../shared/current-task';
import { Button } from '../../../components/Button/Button';
import { useProgressPops } from '../../../hooks/useProgressPops';
import { useGoalsAndTasks } from '../../hooks/useGoalsAndTasks';
import { GoalCard } from './GoalCard/GoalCard';
import { SetupModal } from './SetupModal/SetupModal';
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
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [progressPopsEnabled, setProgressPopsEnabled] = useState(false);

  const loadProgressPopsSetting = useCallback(async () => {
    const settings = await window.api.getSettings();
    setProgressPopsEnabled(settings.progressPopsEnabled ?? false);
  }, []);

  const { goals, tasks, tasksByGoal, loading, fetchData } = useGoalsAndTasks({
    loadExtra: loadProgressPopsSetting,
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

  const deleteGoal = useCallback(
    async (goal: Goal) => {
      if (
        !confirm(`Are you sure you want to delete the goal "${goal.title}" and all its subtasks?`)
      ) {
        return;
      }
      try {
        await window.api.deleteGoal(goal.id);
        if (expandedGoalId === goal.id) {
          setExpandedGoalId(null);
        }
        await fetchData();
      } catch (err) {
        console.error('Failed to delete goal:', err);
      }
    },
    [expandedGoalId, fetchData],
  );

  const deleteStep = useCallback(
    async (step: Task) => {
      if (!confirm(`Are you sure you want to delete the subtask "${step.title}"?`)) return;
      try {
        await window.api.deleteTask(step.id);
        await fetchData();
      } catch (err) {
        console.error('Failed to delete subtask:', err);
      }
    },
    [fetchData],
  );

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

  const closeSetupModal = () => setShowSetupModal(false);
  const finishSetupFlow = () => {
    setShowSetupModal(false);
    void fetchData();
  };

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
          <SetupModal
            closeButtonPlacement="content"
            onDismiss={closeSetupModal}
            onFlowClose={finishSetupFlow}
          />
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
          <GoalCard
            key={goal.id}
            goal={goal}
            progress={progress}
            isActive={isActive}
            isExpanded={expandedGoalId === goal.id}
            stepsExpanded={stepsExpanded}
            hasTasks={(tasksByGoal[goal.id] ?? []).length > 0}
            steps={activeGoalSteps}
            activeTaskId={activeTaskId}
            progressPopsEnabled={progressPopsEnabled}
            pops={pops}
            finishTitle={
              defaultCurrentTask ? `Finish "${defaultCurrentTask.title}"` : 'Finish current task'
            }
            onToggleExpand={() => {
              if (expandedGoalId === goal.id) {
                setStepsExpanded((v) => !v);
              } else {
                setExpandedGoalId(goal.id);
                setStepsExpanded(true);
              }
            }}
            onSwitch={() => void watchGoal(goal)}
            onFinish={() => void finishActiveTask()}
            onDelete={() => void deleteGoal(goal)}
            onHideSteps={() => setStepsExpanded(false)}
            onToggleStepDone={(step) => void toggleTaskDone(step)}
            onDeleteStep={(step) => void deleteStep(step)}
          />
        ))}
      </div>

      {showSetupModal && (
        <SetupModal
          closeButtonPlacement="backdrop"
          onDismiss={closeSetupModal}
          onFlowClose={finishSetupFlow}
        />
      )}
    </div>
  );
}

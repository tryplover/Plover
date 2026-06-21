import { useState, useEffect, useCallback } from 'react';
import { Task, Goal } from '../../../shared/types';
import { isToday } from '../../lib/date';
import { StepRow } from '../../components/StepRow';
import { ProgressLine } from '../../components/ProgressLine';
import { StatusIndicator } from '../../components/StatusIndicator';
import { Button } from '../../components/Button';

interface TasksTodayProps {
  onTasksUpdated?: () => void;
}

export default function TasksToday({ onTasksUpdated }: TasksTodayProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodayData = useCallback(async () => {
    try {
      const allTasks = await window.api.getTasks();
      const allGoals = await window.api.getGoals();
      setTasks(allTasks);
      setGoals(allGoals);
    } catch (err) {
      console.error('Failed to load today tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTodayData();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as { type: string };
      if (
        appEvent.type === 'task.completed' ||
        appEvent.type === 'task.scheduled' ||
        appEvent.type === 'goal.created' ||
        appEvent.type === 'calendar.synced'
      ) {
        void fetchTodayData();
        if (onTasksUpdated) {
          onTasksUpdated();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTodayData, onTasksUpdated]);

  const handleTaskClick = async (taskId: string) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const newStatus = task.status === 'done' ? 'scheduled' : 'done';
      await window.api.updateTaskStatus(taskId, newStatus);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t,
        ),
      );
      if (onTasksUpdated) {
        onTasksUpdated();
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleOpenSetup = async () => {
    try {
      await window.api.openOverlay();
    } catch (err) {
      console.error('Failed to open overlay:', err);
    }
  };

  const todayTasks = tasks.filter((t) => isToday(t.scheduled_start));
  const completedCount = todayTasks.filter((t) => t.status === 'done').length;

  const goalsWithTodayTasks = goals.filter((goal) => {
    const goalTasks = todayTasks.filter((t) => t.goal_id === goal.id);
    return goalTasks.length > 0;
  });

  const getNearestCurrentTask = (goalId: string) => {
    const goalTasks = todayTasks
      .filter((t) => t.goal_id === goalId && t.status !== 'done')
      .sort(
        (a, b) =>
          new Date(a.scheduled_start ?? 0).getTime() - new Date(b.scheduled_start ?? 0).getTime(),
      );
    return goalTasks[0];
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
        Today
      </h1>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {todayTasks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '48px 24px',
            }}
          >
            <StatusIndicator kind="not-sure" label="nothing scheduled" />
            <Button variant="primary" onClick={handleOpenSetup}>
              Open setup overlay
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {goalsWithTodayTasks.map((goal) => {
              const goalTasks = todayTasks.filter((t) => t.goal_id === goal.id);
              const doneTasks = goalTasks.filter((t) => t.status === 'done');
              const progressValue = goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
              const currentTask = getNearestCurrentTask(goal.id);

              return (
                <div
                  key={goal.id}
                  style={{
                    backgroundColor: 'var(--plover-surface)',
                    borderRadius: 'var(--plover-radius-lg)',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--plover-text)',
                      }}
                    >
                      {goal.title}
                    </h2>
                    <ProgressLine value={progressValue} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {goalTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task.id)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <StepRow
                          label={task.title}
                          state={
                            task.status === 'done'
                              ? 'done'
                              : currentTask?.id === task.id
                                ? 'current'
                                : 'pending'
                          }
                          trailing={
                            currentTask?.id === task.id ? (
                              <span style={{ fontSize: '11px', color: 'var(--plover-text-muted)' }}>
                                now
                              </span>
                            ) : null
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

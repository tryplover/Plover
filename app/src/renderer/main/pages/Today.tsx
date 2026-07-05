import { useState, useEffect, useCallback } from 'react';
import { Goal, Task } from '../../../shared/types';
import { StepRow } from '../../components/StepRow';
import { ProgressLine } from '../../components/ProgressLine';
import { isToday } from '../../lib/date';
import { StatusIndicator } from '../../components/StatusIndicator';
import { useAppEvents } from '../../hooks/useAppEvents';

interface TodayProps {
  'data-testid'?: string;
  onTasksUpdated?: () => void;
}

export default function Today({ 'data-testid': dataTestId, onTasksUpdated }: TodayProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const allGoals = await window.api.getGoals();
      const allTasks = await window.api.getTasks();
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
    if (onTasksUpdated) {
      onTasksUpdated();
    }
  });

  const handleTaskStatusToggle = async (taskId: string, currentStatus: Task['status']) => {
    try {
      const newStatus = currentStatus === 'done' ? 'scheduled' : 'done';
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

  // Filter today's tasks
  const todayTasks = tasks.filter((t) => isToday(t.scheduled_start));

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
      <div
        data-testid={dataTestId}
        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div
      data-testid={dataTestId}
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--plover-font-serif)',
            fontSize: '36px',
            fontWeight: 400,
            color: 'var(--plover-text)',
          }}
        >
          Today
        </h1>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        {/* Today's Focus Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--plover-text-muted)',
              marginBottom: '16px',
            }}
          >
            Today's Focus
          </h2>

          {todayTasks.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--plover-surface)',
                borderRadius: 'var(--plover-radius-lg)',
                padding: '32px 24px',
                border: '1px solid var(--plover-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'center',
              }}
            >
              <StatusIndicator kind="not-sure" label="nothing scheduled" />
              <p style={{ fontSize: '13px', color: 'var(--plover-text-dim)' }}>
                No tasks scheduled for today. Create a new goal or break down active ones to
                schedule tasks.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {goalsWithTodayTasks.map((goal) => {
                const goalTasks = todayTasks.filter((t) => t.goal_id === goal.id);
                const doneTasks = goalTasks.filter((t) => t.status === 'done');
                const progressValue =
                  goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
                const currentTask = getNearestCurrentTask(goal.id);

                return (
                  <div
                    key={`today-${goal.id}`}
                    style={{
                      backgroundColor: 'var(--plover-surface)',
                      borderRadius: 'var(--plover-radius-lg)',
                      padding: '20px',
                      border: '1px solid var(--plover-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--plover-text)',
                        }}
                      >
                        {goal.title}
                      </h3>
                      <ProgressLine value={progressValue} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {goalTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleTaskStatusToggle(task.id, task.status)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
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
                                <span
                                  style={{ fontSize: '11px', color: 'var(--plover-text-muted)' }}
                                >
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
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Goal, Task } from '../../../shared/types';
import { StepRow } from '../../components/StepRow';
import { ProgressLine } from '../../components/ProgressLine';
import { Button } from '../../components/Button';
import { SetupFlow } from '../../overlay/SetupFlow';
import { useAppEvents } from '../../hooks/useAppEvents';

interface GoalsListProps {
  'data-testid'?: string;
  onTasksUpdated?: () => void;
}

export default function GoalsList({ 'data-testid': dataTestId, onTasksUpdated }: GoalsListProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);

  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

  // Memoize task grouping to avoid O(Goals * Tasks) filtering in the render loop
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
      // Parallelize fetching goals and tasks to reduce cumulative latency.
      // Savings: min(latency(getGoals), latency(getTasks)).
      const [allGoals, allTasks] = await Promise.all([
        window.api.getGoals(),
        window.api.getTasks(),
      ]);
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
  }, [fetchData]);

  useAppEvents(() => {
    void fetchData();
    if (onTasksUpdated) {
      onTasksUpdated();
    }
  });

  const toggleExpandGoal = (goalId: string) => {
    setExpandedGoals((prev) => ({
      ...prev,
      [goalId]: !prev[goalId],
    }));
  };

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
        paddingRight: '0px',
        backgroundColor: 'var(--plover-bg)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          paddingRight: '40px',
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
          Goals
        </h1>
        <Button variant="primary" onClick={() => setShowSetupModal(true)}>
          + Create Goal
        </Button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '40px', paddingBottom: '24px' }}>
        {/* All Goals Section */}
        <div>
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
            All Goals
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {goals.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--plover-surface)',
                  borderRadius: 'var(--plover-radius-lg)',
                  padding: '48px 24px',
                  border: '1px solid var(--plover-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '14px', color: 'var(--plover-text-muted)' }}>
                  You don't have any goals active. Let's create one to start tracking progress!
                </p>
                <Button variant="primary" onClick={() => setShowSetupModal(true)}>
                  Create Your First Goal
                </Button>
              </div>
            ) : (
              goals.map((goal) => {
                const goalTasks = tasksByGoal[goal.id] || [];
                const doneTasks = goalTasks.filter((t) => t.status === 'done');
                const progressValue =
                  goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
                const isOpen = !!expandedGoals[goal.id];

                return (
                  <div
                    key={goal.id}
                    style={{
                      backgroundColor: 'var(--plover-surface)',
                      borderRadius: 'var(--plover-radius-lg)',
                      border: '1px solid var(--plover-border)',
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
                        padding: '20px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <h3
                          style={{ fontSize: '16px', fontWeight: 650, color: 'var(--plover-text)' }}
                        >
                          {goal.title}
                        </h3>
                        {goal.description && (
                          <p
                            style={{
                              fontSize: '13px',
                              color: 'var(--plover-text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <ProgressLine value={progressValue} />
                        <span
                          style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s',
                            display: 'inline-block',
                            color: 'var(--plover-text-muted)',
                            fontSize: '12px',
                          }}
                        >
                          ▼
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          padding: '0 20px 20px 20px',
                          borderTop: `1px solid var(--plover-border)`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginTop: '16px',
                          }}
                        >
                          {goalTasks.length === 0 ? (
                            <p
                              style={{
                                fontSize: '13px',
                                color: 'var(--plover-text-dim)',
                                fontStyle: 'italic',
                              }}
                            >
                              No subtasks created for this goal.
                            </p>
                          ) : (
                            goalTasks.map((task) => (
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
                                  state={task.status === 'done' ? 'done' : 'pending'}
                                  trailing={`${task.estimate_minutes}m`}
                                />
                              </button>
                            ))
                          )}
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

      {/* Goal Creation Setup Flow Modal Overlay */}
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

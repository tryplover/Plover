import { useState, useEffect, useCallback } from 'react';
import { Task, Goal } from '../../../shared/types';
import { isToday } from '../../lib/date';

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
    void fetchTodayData();

    // Subscribe to IPC event bus updates for live refreshes
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

  const handleMarkDone = async (taskId: string) => {
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

  const getGoalTitle = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    return goal ? goal.title : 'General Goal';
  };

  const todayTasks = tasks.filter((t) => isToday(t.scheduled_start));
  const completedCount = todayTasks.filter((t) => t.status === 'done').length;

  const getGroup = (isoString?: string) => {
    if (!isoString) return 'Morning';
    const hour = new Date(isoString).getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const morningTasks = todayTasks
    .filter((t) => getGroup(t.scheduled_start) === 'Morning')
    .sort(
      (a, b) =>
        new Date(a.scheduled_start ?? 0).getTime() - new Date(b.scheduled_start ?? 0).getTime(),
    );

  const afternoonTasks = todayTasks
    .filter((t) => getGroup(t.scheduled_start) === 'Afternoon')
    .sort(
      (a, b) =>
        new Date(a.scheduled_start ?? 0).getTime() - new Date(b.scheduled_start ?? 0).getTime(),
    );

  const eveningTasks = todayTasks
    .filter((t) => getGroup(t.scheduled_start) === 'Evening')
    .sort(
      (a, b) =>
        new Date(a.scheduled_start ?? 0).getTime() - new Date(b.scheduled_start ?? 0).getTime(),
    );

  const renderTaskItem = (task: Task) => {
    const startTimeStr = task.scheduled_start
      ? new Date(task.scheduled_start).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const endTimeStr = task.scheduled_end
      ? new Date(task.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <div key={task.id} className={`timeline-item ${task.status === 'done' ? 'done' : ''}`}>
        <div className="task-info">
          <div className="task-title-row">
            <span className="task-title">{task.title}</span>
            <span className="task-duration">{task.estimate_minutes}m</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
            <span className="task-goal-tag">{getGoalTitle(task.goal_id)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {startTimeStr} - {endTimeStr}
            </span>
          </div>
        </div>
        <button
          className={`circle-check-button ${task.status === 'done' ? 'done' : ''}`}
          onClick={() => handleMarkDone(task.id)}
          aria-label="Mark done"
        >
          {task.status === 'done' ? '✓' : ''}
        </button>
      </div>
    );
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

  const todayDateString = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="main-content">
      <div
        className="page-header"
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <div>
          <span className="page-subtitle">{todayDateString}</span>
          <h1 className="page-title">Today's Focus</h1>
        </div>
        {todayTasks.length > 0 && (
          <div className="goal-progress-container" style={{ width: '220px' }}>
            <div className="goal-progress-bar">
              <div
                className="goal-progress-fill"
                style={{ width: `${(completedCount / todayTasks.length) * 100}%` }}
              />
            </div>
            <span className="goal-progress-text">
              {completedCount} / {todayTasks.length} Done (
              {Math.round((completedCount / todayTasks.length) * 100)}%)
            </span>
          </div>
        )}
      </div>

      {todayTasks.length === 0 ? (
        <div className="card" style={{ alignItems: 'center', padding: '48px', gap: '12px' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
            All caught up!
          </span>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              maxWidth: '320px',
            }}
          >
            No tasks are scheduled for today. Add a new goal in the Goals tab to plan out subtasks.
          </p>
        </div>
      ) : (
        <div className="timeline-container">
          {morningTasks.length > 0 && (
            <div className="timeline-group">
              <div className="timeline-time-label">Morning</div>
              {morningTasks.map(renderTaskItem)}
            </div>
          )}

          {afternoonTasks.length > 0 && (
            <div className="timeline-group">
              <div className="timeline-time-label">Afternoon</div>
              {afternoonTasks.map(renderTaskItem)}
            </div>
          )}

          {eveningTasks.length > 0 && (
            <div className="timeline-group">
              <div className="timeline-time-label">Evening</div>
              {eveningTasks.map(renderTaskItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

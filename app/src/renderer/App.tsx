import { useState, useEffect } from 'react';
import TasksToday from './main/pages/TasksToday';
import GoalsList from './main/pages/GoalsList';
import Settings from './main/pages/Settings';
import { Activity } from './main/pages/Activity';
import { isToday } from './lib/date';
import { IconSun, IconTarget, IconGear } from './main/icons';

export function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'goals' | 'settings' | 'activity'>('today');
  const [todayPendingCount, setTodayPendingCount] = useState(0);

  const fetchTodayCount = async () => {
    try {
      const allTasks = await window.api.getTasks();
      const todayTasks = allTasks.filter((t) => isToday(t.scheduled_start) && t.status !== 'done');
      setTodayPendingCount(todayTasks.length);
    } catch (err) {
      console.error('Failed to fetch task count:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTodayCount();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as { type: string };
      if (
        appEvent.type === 'task.completed' ||
        appEvent.type === 'task.scheduled' ||
        appEvent.type === 'goal.created' ||
        appEvent.type === 'calendar.synced'
      ) {
        void fetchTodayCount();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <div className="plover-brand">
            <span className="plover-brand__dot" aria-hidden />
            <span className="plover-brand__word">Plover</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
              data-testid="nav-today"
            >
              <IconSun />
              <span>Today</span>
              {todayPendingCount > 0 && <span className="badge">{todayPendingCount}</span>}
            </button>

            <button
              className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`}
              onClick={() => setActiveTab('goals')}
              data-testid="nav-goals"
            >
              <IconTarget />
              <span>Goals</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              data-testid="nav-settings"
            >
              <IconGear />
              <span>Settings</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
              data-testid="nav-activity"
            >
              <span>Activity</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-version">Plover v1.0.0</div>
      </aside>

      <main style={{ flexGrow: 1, overflow: 'hidden', height: '100%' }}>
        {activeTab === 'today' && <TasksToday onTasksUpdated={fetchTodayCount} data-testid="page-today" />}
        {activeTab === 'goals' && <GoalsList data-testid="page-goals" />}
        {activeTab === 'settings' && <Settings data-testid="page-settings" />}
        {activeTab === 'activity' && <Activity />}
      </main>
    </div>
  );
}

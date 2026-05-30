import { useState, useEffect } from 'react';
import TasksToday from './main/pages/TasksToday';
import GoalsList from './main/pages/GoalsList';
import Settings from './main/pages/Settings';

export function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'goals' | 'settings'>('today');
  const [todayPendingCount, setTodayPendingCount] = useState(0);

  const fetchTodayCount = async () => {
    try {
      const allTasks = await window.api.getTasks();

      const isToday = (isoString?: string) => {
        if (!isoString) return false;
        const date = new Date(isoString);
        const today = new Date();
        return (
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        );
      };

      const todayTasks = allTasks.filter((t) => isToday(t.scheduled_start) && t.status !== 'done');
      setTodayPendingCount(todayTasks.length);
    } catch (err) {
      console.error('Failed to fetch task count:', err);
    }
  };

  useEffect(() => {
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
          <div className="logo-section">
            <div className="logo-icon">T</div>
            <span className="logo-text">Plover</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveTab('today')}
            >
              <span className="nav-icon">☀️</span>
              <span>Today</span>
              {todayPendingCount > 0 && <span className="badge">{todayPendingCount}</span>}
            </button>

            <button
              className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`}
              onClick={() => setActiveTab('goals')}
            >
              <span className="nav-icon">🎯</span>
              <span>Goals</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div
          style={{
            padding: '8px',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          Plover v1.0.0
        </div>
      </aside>

      <main style={{ flexGrow: 1, overflow: 'hidden', height: '100%' }}>
        {activeTab === 'today' && <TasksToday onTasksUpdated={fetchTodayCount} />}
        {activeTab === 'goals' && <GoalsList />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import GoalsList from './main/pages/GoalsList';
import AIProgress from './main/pages/AIProgress';
import Settings from './main/pages/Settings';
import { Onboarding } from './main/pages/Onboarding';
import { Activity } from './main/pages/Activity';
import { isToday } from './lib/date';
import { IconTarget, IconGear, IconActivity } from './main/icons';

export function App() {
  const [activeTab, setActiveTab] = useState<'goals' | 'progress' | 'settings' | 'activity'>('goals');
  const [todayPendingCount, setTodayPendingCount] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem('plover_onboarding_completed') === 'true';
  });

  const fetchTodayCount = useCallback(async () => {
    try {
      const allTasks = await window.api.getTasks();
      const todayTasks = allTasks.filter((t) => isToday(t.scheduled_start) && t.status !== 'done');
      setTodayPendingCount(todayTasks.length);
    } catch (err) {
      console.error('Failed to fetch task count:', err);
    }
  }, []);

  useEffect(() => {
    if (!onboardingCompleted) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTodayCount();

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
  }, [onboardingCompleted, fetchTodayCount]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('plover_onboarding_completed', 'true');
    setOnboardingCompleted(true);
  };

  if (!onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

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
              className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`}
              onClick={() => setActiveTab('goals')}
              data-testid="nav-goals"
            >
              <IconTarget />
              <span>Goals</span>
              {todayPendingCount > 0 && <span className="badge">{todayPendingCount}</span>}
            </button>

            <button
              className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
              data-testid="nav-progress"
            >
              <IconActivity />
              <span>AI Progress</span>
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
        {activeTab === 'goals' && <GoalsList onTasksUpdated={fetchTodayCount} data-testid="page-goals" />}
        {activeTab === 'progress' && <AIProgress data-testid="page-progress" />}
        {activeTab === 'settings' && <Settings data-testid="page-settings" />}
        {activeTab === 'activity' && <Activity />}
      </main>
    </div>
  );
}

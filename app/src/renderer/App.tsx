import { useState, useEffect } from 'react';
import GoalsList from './main/pages/GoalsList';
import AIProgress from './main/pages/AIProgress';
import Settings from './main/pages/Settings';
import { Onboarding } from './main/pages/Onboarding';
import { IconTarget, IconGear, IconActivity } from './main/icons';
import ploverLogo from './plover-logo.png';

type Tab = 'goals' | 'progress' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('goals');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem('plover_onboarding_completed') === 'true';
  });

  useEffect(() => {
    document.body.style.background = 'var(--plover-bg, #141517)';
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('plover_onboarding_completed', 'true');
    setOnboardingCompleted(true);
  };

  if (!onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app-container">
      <div className="app-drag-region" />
      <aside className="sidebar">
        <div>
          <div className="plover-brand">
            <img src={ploverLogo} className="plover-brand__logo" alt="Plover Logo" />
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
          </nav>
        </div>

        <div className="sidebar-version">Plover v{import.meta.env.PLOVER_VERSION}</div>
      </aside>

      <main className="main-content">
        {activeTab === 'goals' && <GoalsList data-testid="page-goals" />}
        {activeTab === 'progress' && <AIProgress data-testid="page-progress" />}
        {activeTab === 'settings' && <Settings data-testid="page-settings" />}
      </main>
    </div>
  );
}

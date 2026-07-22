import { useState, useEffect } from 'react';
import Home from './main/pages/Home';
import GoalsList from './main/pages/GoalsList';
import AIProgress from './main/pages/AIProgress';
import Settings from './main/pages/Settings';
import { Onboarding } from './main/pages/Onboarding';
import { IconHome, IconTarget, IconGear, IconActivity } from './main/icons';
import ploverLogo from './plover-logo.png';

type Tab = 'home' | 'goals' | 'progress' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem('plover_onboarding_completed') === 'true';
  });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((settings) => {
        if (active && settings.theme) {
          setTheme(settings.theme);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    document.body.style.background = theme === 'light' ? '#f3eee4' : '#141517';
  }, [theme]);

  useEffect(() => {
    let active = true;
    window.api.auth
      .getStatus()
      .then(({ email }) => {
        if (active) setAccountEmail(email);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('plover_onboarding_completed', 'true');
    setOnboardingCompleted(true);
  };

  if (!onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div
      className={`app-container ${theme === 'light' ? 'plover-shell--light' : 'plover-shell--dark'}`}
    >
      <div className="app-drag-region" />
      <aside className="sidebar">
        <div>
          <div className="plover-brand">
            <img src={ploverLogo} className="plover-brand__logo" alt="Plover Logo" />
            <span className="plover-brand__word">Plover</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
              data-testid="nav-home"
            >
              <IconHome />
              <span>Home</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`}
              onClick={() => setActiveTab('goals')}
              data-testid="nav-goals"
            >
              <IconTarget />
              <span>All tasks</span>
            </button>

            <button
              className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
              data-testid="nav-progress"
            >
              <IconActivity />
              <span>History</span>
            </button>
          </nav>
        </div>

        <div>
          <nav className="nav-links">
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              data-testid="nav-settings"
            >
              <IconGear />
              <span>Settings</span>
            </button>
          </nav>

          <div className="plover-profile-row">
            <span className="plover-profile-row__avatar" aria-hidden>
              {accountEmail ? accountEmail[0]?.toUpperCase() : '?'}
            </span>
            <span className="plover-profile-row__label">{accountEmail ?? 'Not signed in'}</span>
          </div>
        </div>
        <div className="sidebar-version">Plover v{import.meta.env.PLOVER_VERSION}</div>
      </aside>

      <main className="main-content">
        {activeTab === 'home' && <Home data-testid="page-home" />}
        {activeTab === 'goals' && <GoalsList data-testid="page-goals" />}
        {activeTab === 'progress' && <AIProgress data-testid="page-progress" />}
        {activeTab === 'settings' && <Settings data-testid="page-settings" />}
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function Settings() {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '18:00' });
  const [horizonDays, setHorizonDays] = useState(14);
  const [pauseScheduling, setPauseScheduling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const fetchSettings = async () => {
    try {
      const settings = await window.api.getSettings();
      setGoogleConnected(settings.googleConnected);
      setWorkingHours(settings.workingHours || { start: '09:00', end: '18:00' });
      setHorizonDays(settings.horizonDays || 14);
      setPauseScheduling(settings.pauseScheduling || false);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
  }, []);

  const triggerAutoSave = async (
    updatedSettings: Partial<{
      googleConnected: boolean;
      workingHours: { start: string; end: string };
      horizonDays: number;
      pauseScheduling: boolean;
    }>,
  ) => {
    setSaveStatus('saving');
    try {
      await window.api.updateSettings(updatedSettings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Failed to update settings:', err);
      setSaveStatus('idle');
    }
  };

  const handleConnectCalendar = async () => {
    try {
      if (googleConnected) {
        await window.api.disconnectCalendar();
        setGoogleConnected(false);
        await triggerAutoSave({ googleConnected: false });
      } else {
        const success = await window.api.connectCalendar();
        if (success) {
          setGoogleConnected(true);
          await triggerAutoSave({ googleConnected: true });
        }
      }
    } catch (err) {
      console.error('Google Calendar toggle failed:', err);
    }
  };

  const handleWorkingHoursChange = (field: 'start' | 'end', value: string) => {
    const updatedHours = { ...workingHours, [field]: value };
    setWorkingHours(updatedHours);
    void triggerAutoSave({ workingHours: updatedHours });
  };

  const handleHorizonChange = (value: number) => {
    const val = Math.max(1, value);
    setHorizonDays(val);
    void triggerAutoSave({ horizonDays: val });
  };

  const handlePauseSchedulingToggle = () => {
    const nextVal = !pauseScheduling;
    setPauseScheduling(nextVal);
    void triggerAutoSave({ pauseScheduling: nextVal });
  };

  return (
    <div className="main-content">
      <div
        className="page-header"
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <span className="page-subtitle">Preferences</span>
          <h1 className="page-title">Settings</h1>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          {saveStatus === 'saving' && (
            <div className="loading-spinner" style={{ width: '12px', height: '12px' }} />
          )}
          {saveStatus === 'saved' && (
            <span style={{ color: 'var(--accent-success)' }}>✓ Saved</span>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px' }}>
          Google Calendar
        </h2>
        <div className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">OAuth Sync</span>
              <span className="setting-description">
                Connect your Google Calendar to auto-schedule tasks and avoid double bookings.
              </span>
            </div>
            <div className="setting-control">
              <span className={`oauth-badge ${googleConnected ? 'connected' : ''}`}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: googleConnected
                      ? 'var(--accent-success)'
                      : 'var(--text-tertiary)',
                  }}
                />
                {googleConnected ? 'Connected' : 'Disconnected'}
              </span>
              <button
                className={`btn ${googleConnected ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConnectCalendar}
              >
                {googleConnected ? 'Disconnect Calendar' : 'Connect Calendar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px' }}>
          Scheduler Configuration
        </h2>
        <div className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Daily Working Hours</span>
              <span className="setting-description">
                Specify the start and end of your workday for task scheduling.
              </span>
            </div>
            <div className="setting-control">
              <div className="input-time-group">
                <input
                  type="time"
                  className="input-field"
                  value={workingHours.start}
                  onChange={(e) => handleWorkingHoursChange('start', e.target.value)}
                />
                <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>to</span>
                <input
                  type="time"
                  className="input-field"
                  value={workingHours.end}
                  onChange={(e) => handleWorkingHoursChange('end', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Scheduling Horizon</span>
              <span className="setting-description">
                Maximum days in the future the scheduler will plan tasks.
              </span>
            </div>
            <div className="setting-control">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="input-field"
                  style={{ width: '80px' }}
                  value={horizonDays}
                  min="1"
                  max="90"
                  onChange={(e) => handleHorizonChange(Number(e.target.value))}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>days</span>
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Pause Auto-Scheduling</span>
              <span className="setting-description">
                Temporarily stop the agent from scheduling new tasks on your calendar.
              </span>
            </div>
            <div className="setting-control">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={pauseScheduling}
                  onChange={handlePauseSchedulingToggle}
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ opacity: 0.6 }}>
        <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px' }}>Privacy & Data</h2>
        <div className="settings-section">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Local Data Storage</span>
              <span className="setting-description">
                All goals, task histories, and credentials are saved locally on your device.
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              Local SQLite
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

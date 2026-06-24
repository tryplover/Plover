import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';

interface SettingsProps {
  'data-testid'?: string;
}

export default function Settings({ 'data-testid': dataTestId }: SettingsProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--plover-font-serif)',
            fontSize: '36px',
            fontWeight: 400,
            color: 'var(--plover-text)',
          }}
        >
          Settings
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--plover-text-muted)',
          }}
        >
          {saveStatus === 'saving' && (
            <div className="loading-spinner" style={{ width: '12px', height: '12px' }} />
          )}
          {saveStatus === 'saved' && (
            <>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--plover-mint)',
                }}
              />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div
            style={{
              backgroundColor: 'var(--plover-surface)',
              borderRadius: 'var(--plover-radius-lg)',
              padding: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginBottom: '16px',
                color: 'var(--plover-text)',
              }}
            >
              Account
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Google Calendar
                </p>
                {googleConnected && (
                  <p style={{ fontSize: '13px', color: 'var(--plover-text-muted)', marginTop: '4px' }}>
                    Connected as account
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {googleConnected && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--plover-text-muted)' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--plover-mint)',
                      }}
                    />
                    Connected
                  </span>
                )}
                <Button
                  variant={googleConnected ? 'secondary' : 'primary'}
                  onClick={handleConnectCalendar}
                >
                  {googleConnected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--plover-surface)',
              borderRadius: 'var(--plover-radius-lg)',
              padding: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginBottom: '16px',
                color: 'var(--plover-text)',
              }}
            >
              Working hours
            </h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="time"
                value={workingHours.start}
                onChange={(e) => handleWorkingHoursChange('start', e.target.value)}
                style={{
                  backgroundColor: 'var(--plover-surface-raised)',
                  border: '1px solid var(--plover-border)',
                  borderRadius: 'var(--plover-radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--plover-text)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ color: 'var(--plover-text-muted)', fontSize: '14px' }}>to</span>
              <input
                type="time"
                value={workingHours.end}
                onChange={(e) => handleWorkingHoursChange('end', e.target.value)}
                style={{
                  backgroundColor: 'var(--plover-surface-raised)',
                  border: '1px solid var(--plover-border)',
                  borderRadius: 'var(--plover-radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--plover-text)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--plover-surface)',
              borderRadius: 'var(--plover-radius-lg)',
              padding: '24px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                marginBottom: '16px',
                color: 'var(--plover-text)',
              }}
            >
              Scheduling
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Horizon
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={horizonDays}
                    onChange={(e) => handleHorizonChange(Number(e.target.value))}
                    min="1"
                    max="90"
                    style={{
                      width: '80px',
                      backgroundColor: 'var(--plover-surface-raised)',
                      border: '1px solid var(--plover-border)',
                      borderRadius: 'var(--plover-radius-sm)',
                      padding: '8px 12px',
                      color: 'var(--plover-text)',
                      fontSize: '14px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--plover-text-muted)' }}>days</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Pause scheduling
                </label>
                <Chip
                  selected={pauseScheduling}
                  onClick={handlePauseSchedulingToggle}
                >
                  {pauseScheduling ? 'Paused' : 'Active'}
                </Chip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';

interface SettingsProps {
  'data-testid'?: string;
}

interface ActivitySettings {
  pauseAllTracking: boolean;
  windowTrackingEnabled: boolean;
  gdocsPollingEnabled: boolean;
  fileWatchingEnabled: boolean;
  screenCaptureEnabled: boolean;
  screenCaptureIntervalMinutes: number;
  screenVisionInferenceEnabled: boolean;
  activityRetentionDays: number;
  planner_useRecentActivityContext: boolean;
}

const defaultActivitySettings: ActivitySettings = {
  pauseAllTracking: false,
  windowTrackingEnabled: true,
  gdocsPollingEnabled: true,
  fileWatchingEnabled: true,
  screenCaptureEnabled: false,
  screenCaptureIntervalMinutes: 5,
  screenVisionInferenceEnabled: false,
  activityRetentionDays: 30,
  planner_useRecentActivityContext: true,
};

interface AuthStatus {
  signedIn: boolean;
  email: string | null;
}

export default function Settings({ 'data-testid': dataTestId }: SettingsProps) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ signedIn: false, email: null });
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '18:00' });
  const [horizonDays, setHorizonDays] = useState(14);
  const [pauseScheduling, setPauseScheduling] = useState(false);
  const [activitySettings, setActivitySettings] =
    useState<ActivitySettings>(defaultActivitySettings);
  const [screenPermission, setScreenPermission] = useState<string>('not-determined');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activityMessage, setActivityMessage] = useState<string>('');

  const fetchSettings = async () => {
    try {
      const settings = await window.api.getSettings();
      setGoogleConnected(settings.googleConnected);
      setWorkingHours(settings.workingHours || { start: '09:00', end: '18:00' });
      setHorizonDays(settings.horizonDays || 14);
      setPauseScheduling(settings.pauseScheduling || false);
      setActivitySettings({
        pauseAllTracking: settings.pauseAllTracking ?? defaultActivitySettings.pauseAllTracking,
        windowTrackingEnabled:
          settings.windowTrackingEnabled ?? defaultActivitySettings.windowTrackingEnabled,
        gdocsPollingEnabled:
          settings.gdocsPollingEnabled ?? defaultActivitySettings.gdocsPollingEnabled,
        fileWatchingEnabled:
          settings.fileWatchingEnabled ?? defaultActivitySettings.fileWatchingEnabled,
        screenCaptureEnabled:
          settings.screenCaptureEnabled ?? defaultActivitySettings.screenCaptureEnabled,
        screenCaptureIntervalMinutes:
          settings.screenCaptureIntervalMinutes ??
          defaultActivitySettings.screenCaptureIntervalMinutes,
        screenVisionInferenceEnabled:
          settings.screenVisionInferenceEnabled ??
          defaultActivitySettings.screenVisionInferenceEnabled,
        activityRetentionDays:
          settings.activityRetentionDays ?? defaultActivitySettings.activityRetentionDays,
        planner_useRecentActivityContext:
          settings.planner_useRecentActivityContext ??
          defaultActivitySettings.planner_useRecentActivityContext,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchAuthStatus = async () => {
    try {
      const status = await window.api.auth.getStatus();
      setAuthStatus(status);
    } catch (err) {
      console.error('Failed to fetch Plover Account status:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
    void window.api.getScreenRecordingStatus().then(setScreenPermission);
    void fetchAuthStatus();
    const unsubscribe = window.api.on('auth:status-changed', (status: unknown) => {
      setAuthStatus(status as AuthStatus);
    });
    return unsubscribe;
  }, []);

  const triggerActivitySave = async (patch: Partial<ActivitySettings>): Promise<void> => {
    const next = { ...activitySettings, ...patch };
    setActivitySettings(next);
    setSaveStatus('saving');
    try {
      await window.api.updateSettings(patch);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Failed to update activity settings:', err);
      setSaveStatus('idle');
    }
  };

  const handleScreenCaptureToggle = async (enabled: boolean): Promise<void> => {
    if (!enabled) {
      await triggerActivitySave({ screenCaptureEnabled: false });
      return;
    }
    const status = await window.api.requestScreenRecording();
    setScreenPermission(status);
    if (status !== 'granted') {
      setActivityMessage(
        'Screen Recording permission is required. Open System Settings → Privacy & Security → Screen & System Audio Recording, enable Plover, and then fully restart the app (Cmd+Q).',
      );
      return;
    }
    setActivityMessage('');
    await triggerActivitySave({ screenCaptureEnabled: true });
  };

  const handleWindowTrackingToggle = async (enabled: boolean): Promise<void> => {
    if (!enabled) {
      await triggerActivitySave({ windowTrackingEnabled: false });
      return;
    }
    const status = await window.api.requestScreenRecording();
    setScreenPermission(status);
    if (status !== 'granted') {
      setActivityMessage(
        'Screen Recording permission is required. Open System Settings → Privacy & Security → Screen & System Audio Recording, enable Plover, and then fully restart the app (Cmd+Q).',
      );
      return;
    }
    setActivityMessage('');
    await triggerActivitySave({ windowTrackingEnabled: true });
  };

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

  const handleConnectGoogle = async () => {
    try {
      if (googleConnected) {
        await window.api.disconnectGoogle();
        setGoogleConnected(false);
        await triggerAutoSave({ googleConnected: false });
      } else {
        const success = await window.api.connectGoogle();
        if (success) {
          setGoogleConnected(true);
          await triggerAutoSave({ googleConnected: true });
        }
      }
    } catch (err) {
      console.error('Google connection toggle failed:', err);
    }
  };

  const handlePloverAccountToggle = async () => {
    try {
      const status = authStatus.signedIn
        ? await window.api.auth.signOut()
        : await window.api.auth.signIn();
      setAuthStatus(status);
    } catch (err) {
      console.error('Plover Account sign-in/out failed:', err);
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
        paddingRight: '0px',
        backgroundColor: 'var(--plover-bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '32px',
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

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '40px', paddingBottom: '24px' }}>
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Plover Account
                </p>
                {authStatus.signedIn && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--plover-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    Signed in as {authStatus.email}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {authStatus.signedIn && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--plover-text-muted)',
                    }}
                  >
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
                  variant={authStatus.signedIn ? 'secondary' : 'primary'}
                  onClick={handlePloverAccountToggle}
                >
                  {authStatus.signedIn ? 'Sign out' : 'Sign in with Google'}
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Google
                </p>
                {googleConnected && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--plover-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    Connect Google to enable Docs progress tracking.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {googleConnected && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--plover-text-muted)',
                    }}
                  >
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
                  onClick={handleConnectGoogle}
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
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
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

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Pause scheduling
                </label>
                <Chip selected={pauseScheduling} onClick={handlePauseSchedulingToggle}>
                  {pauseScheduling ? 'Paused' : 'Active'}
                </Chip>
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
              Activity tracking
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
                  Pause all tracking
                </label>
                <Chip
                  selected={activitySettings.pauseAllTracking}
                  onClick={() =>
                    void triggerActivitySave({
                      pauseAllTracking: !activitySettings.pauseAllTracking,
                    })
                  }
                >
                  {activitySettings.pauseAllTracking ? 'Paused' : 'Active'}
                </Chip>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Window tracking
                  {activitySettings.windowTrackingEnabled && screenPermission !== 'granted' && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--plover-text-muted)',
                        marginLeft: '6px',
                      }}
                    >
                      (permission not granted)
                    </span>
                  )}
                </label>
                <Chip
                  selected={activitySettings.windowTrackingEnabled}
                  onClick={() =>
                    void handleWindowTrackingToggle(!activitySettings.windowTrackingEnabled)
                  }
                >
                  {activitySettings.windowTrackingEnabled ? 'On' : 'Off'}
                </Chip>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Google Docs polling
                </label>
                <Chip
                  selected={activitySettings.gdocsPollingEnabled}
                  onClick={() =>
                    void triggerActivitySave({
                      gdocsPollingEnabled: !activitySettings.gdocsPollingEnabled,
                    })
                  }
                >
                  {activitySettings.gdocsPollingEnabled ? 'On' : 'Off'}
                </Chip>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Watched-folder file events
                </label>
                <Chip
                  selected={activitySettings.fileWatchingEnabled}
                  onClick={() =>
                    void triggerActivitySave({
                      fileWatchingEnabled: !activitySettings.fileWatchingEnabled,
                    })
                  }
                >
                  {activitySettings.fileWatchingEnabled ? 'On' : 'Off'}
                </Chip>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Capture periodic screenshots
                  {activitySettings.screenCaptureEnabled && screenPermission !== 'granted' && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--plover-text-muted)',
                        marginLeft: '6px',
                      }}
                    >
                      (permission not granted)
                    </span>
                  )}
                </label>
                <Chip
                  selected={activitySettings.screenCaptureEnabled}
                  onClick={() =>
                    void handleScreenCaptureToggle(!activitySettings.screenCaptureEnabled)
                  }
                >
                  {activitySettings.screenCaptureEnabled ? 'On' : 'Off'}
                </Chip>
              </div>
              {activityMessage && (
                <div style={{ marginTop: '8px' }}>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--plover-text-muted)',
                      margin: '0 0 6px 0',
                      lineHeight: '1.4',
                    }}
                  >
                    {activityMessage}
                  </p>
                  <button
                    onClick={async () => {
                      void window.api.openScreenRecordingSettings();
                    }}
                    style={{
                      background: 'var(--plover-border)',
                      color: 'var(--plover-text)',
                      border: '1px solid var(--plover-border)',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    Open System Settings →
                  </button>
                </div>
              )}

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Capture interval (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={activitySettings.screenCaptureIntervalMinutes}
                  disabled={!activitySettings.screenCaptureEnabled}
                  onChange={(e) =>
                    void triggerActivitySave({
                      screenCaptureIntervalMinutes: Number(e.target.value),
                    })
                  }
                  style={{
                    width: '72px',
                    backgroundColor: 'var(--plover-surface-raised)',
                    border: '1px solid var(--plover-border)',
                    borderRadius: 'var(--plover-radius-sm)',
                    padding: '6px 10px',
                    color: 'var(--plover-text)',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    opacity: activitySettings.screenCaptureEnabled ? 1 : 0.4,
                  }}
                />
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Send screenshots to Gemini Vision
                </label>
                <div
                  style={{
                    opacity: activitySettings.screenCaptureEnabled ? 1 : 0.4,
                    cursor: activitySettings.screenCaptureEnabled ? 'pointer' : 'not-allowed',
                    pointerEvents: activitySettings.screenCaptureEnabled ? 'auto' : 'none',
                  }}
                >
                  <Chip
                    selected={activitySettings.screenVisionInferenceEnabled}
                    onClick={() => {
                      if (activitySettings.screenCaptureEnabled) {
                        void triggerActivitySave({
                          screenVisionInferenceEnabled:
                            !activitySettings.screenVisionInferenceEnabled,
                        });
                      }
                    }}
                    aria-disabled={!activitySettings.screenCaptureEnabled}
                  >
                    {activitySettings.screenVisionInferenceEnabled ? 'On' : 'Off'}
                  </Chip>
                </div>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Retention (days, 0 = keep forever)
                </label>
                <input
                  type="number"
                  min={0}
                  value={activitySettings.activityRetentionDays}
                  onChange={(e) =>
                    void triggerActivitySave({ activityRetentionDays: Number(e.target.value) })
                  }
                  style={{
                    width: '72px',
                    backgroundColor: 'var(--plover-surface-raised)',
                    border: '1px solid var(--plover-border)',
                    borderRadius: 'var(--plover-radius-sm)',
                    padding: '6px 10px',
                    color: 'var(--plover-text)',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
                  Include recent activity when decomposing goals
                </label>
                <Chip
                  selected={activitySettings.planner_useRecentActivityContext}
                  onClick={() =>
                    void triggerActivitySave({
                      planner_useRecentActivityContext:
                        !activitySettings.planner_useRecentActivityContext,
                    })
                  }
                >
                  {activitySettings.planner_useRecentActivityContext ? 'On' : 'Off'}
                </Chip>
              </div>

              {activityMessage && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--plover-text-muted)' }}>
                    {activityMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

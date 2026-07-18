import { useState, useEffect, CSSProperties } from 'react';
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

// Reusable CSS style objects to reduce technical debt and simplify JSX code blocks
const styles: Record<string, CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingTop: '40px',
    paddingBottom: '40px',
    paddingLeft: '40px',
    paddingRight: '0px',
    backgroundColor: 'var(--plover-bg)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    paddingRight: '40px',
  },
  title: {
    fontFamily: 'var(--plover-font-serif)',
    fontSize: '36px',
    fontWeight: 400,
    color: 'var(--plover-text)',
  },
  saveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--plover-text-muted)',
  },
  greenDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--plover-mint)',
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '40px',
    paddingBottom: '24px',
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  card: {
    backgroundColor: 'var(--plover-surface)',
    borderRadius: 'var(--plover-radius-lg)',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: 'var(--plover-text)',
  },
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flexRowGap12: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  inputRaised: {
    backgroundColor: 'var(--plover-surface-raised)',
    border: '1px solid var(--plover-border)',
    borderRadius: 'var(--plover-radius-sm)',
    padding: '8px 12px',
    color: 'var(--plover-text)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  inputNum: {
    width: '80px',
    backgroundColor: 'var(--plover-surface-raised)',
    border: '1px solid var(--plover-border)',
    borderRadius: 'var(--plover-radius-sm)',
    padding: '8px 12px',
    color: 'var(--plover-text)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  inputSmallNum: {
    width: '72px',
    backgroundColor: 'var(--plover-surface-raised)',
    border: '1px solid var(--plover-border)',
    borderRadius: 'var(--plover-radius-sm)',
    padding: '6px 10px',
    color: 'var(--plover-text)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  textLgBold: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--plover-text)',
  },
  textNormal: {
    fontSize: '14px',
    color: 'var(--plover-text)',
  },
  textMutedSm: {
    fontSize: '13px',
    color: 'var(--plover-text-muted)',
    marginTop: '4px',
  },
  permissionErrorContainer: {
    marginTop: '8px',
  },
  permissionErrorText: {
    fontSize: '13px',
    color: 'var(--plover-text-muted)',
    margin: '0 0 6px 0',
    lineHeight: '1.4',
  },
  permissionBtn: {
    background: 'var(--plover-border)',
    color: 'var(--plover-text)',
    border: '1px solid var(--plover-border)',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};

export default function Settings({ 'data-testid': dataTestId }: SettingsProps) {
  const [googleConnected, setGoogleConnected] = useState(false);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
    void window.api.getScreenRecordingStatus().then(setScreenPermission);
  }, []);

  // Centralized unified save helper to reduce duplication and streamline state changes
  const saveUpdatedSettings = async (patch: Partial<ActivitySettings> | Partial<{
    googleConnected: boolean;
    workingHours: { start: string; end: string };
    horizonDays: number;
    pauseScheduling: boolean;
  }>): Promise<void> => {
    setSaveStatus('saving');
    try {
      await window.api.updateSettings(patch);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Failed to update settings:', err);
      setSaveStatus('idle');
    }
  };

  const triggerActivitySave = async (patch: Partial<ActivitySettings>): Promise<void> => {
    setActivitySettings((prev) => ({ ...prev, ...patch }));
    await saveUpdatedSettings(patch);
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

  const handleConnectCalendar = async () => {
    try {
      if (googleConnected) {
        await window.api.disconnectCalendar();
        setGoogleConnected(false);
        await saveUpdatedSettings({ googleConnected: false });
      } else {
        const success = await window.api.connectCalendar();
        if (success) {
          setGoogleConnected(true);
          await saveUpdatedSettings({ googleConnected: true });
        }
      }
    } catch (err) {
      console.error('Google Calendar toggle failed:', err);
    }
  };

  const handleWorkingHoursChange = (field: 'start' | 'end', value: string) => {
    const updatedHours = { ...workingHours, [field]: value };
    setWorkingHours(updatedHours);
    void saveUpdatedSettings({ workingHours: updatedHours });
  };

  const handleHorizonChange = (value: number) => {
    const val = Math.max(1, value);
    setHorizonDays(val);
    void saveUpdatedSettings({ horizonDays: val });
  };

  const handlePauseSchedulingToggle = () => {
    const nextVal = !pauseScheduling;
    setPauseScheduling(nextVal);
    void saveUpdatedSettings({ pauseScheduling: nextVal });
  };

  return (
    <div data-testid={dataTestId} style={styles.container}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Settings</h1>
        <div style={styles.saveIndicator}>
          {saveStatus === 'saving' && (
            <div className="loading-spinner" style={{ width: '12px', height: '12px' }} />
          )}
          {saveStatus === 'saved' && (
            <>
              <span style={styles.greenDot} />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      <div style={styles.scrollContainer}>
        <div style={styles.sectionList}>
          {/* Account Card */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Account</h2>
            <div style={styles.flexBetween}>
              <div>
                <p style={styles.textLgBold}>Google Calendar</p>
                {googleConnected && (
                  <p style={styles.textMutedSm}>Connected as account</p>
                )}
              </div>
              <div style={styles.flexRowGap12}>
                {googleConnected && (
                  <span style={styles.saveIndicator}>
                    <span style={styles.greenDot} />
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

          {/* Working hours Card */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Working hours</h2>
            <div style={styles.flexRowGap12}>
              <input
                type="time"
                value={workingHours.start}
                onChange={(e) => handleWorkingHoursChange('start', e.target.value)}
                style={styles.inputRaised}
              />
              <span style={{ color: 'var(--plover-text-muted)', fontSize: '14px' }}>to</span>
              <input
                type="time"
                value={workingHours.end}
                onChange={(e) => handleWorkingHoursChange('end', e.target.value)}
                style={styles.inputRaised}
              />
            </div>
          </div>

          {/* Scheduling Card */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Scheduling</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={styles.flexBetween}>
                <label style={styles.textLgBold}>Horizon</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={horizonDays}
                    onChange={(e) => handleHorizonChange(Number(e.target.value))}
                    min="1"
                    max="90"
                    style={styles.inputNum}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--plover-text-muted)' }}>days</span>
                </div>
              </div>

              <div style={styles.flexBetween}>
                <label style={styles.textLgBold}>Pause scheduling</label>
                <Chip selected={pauseScheduling} onClick={handlePauseSchedulingToggle}>
                  {pauseScheduling ? 'Paused' : 'Active'}
                </Chip>
              </div>
            </div>
          </div>

          {/* Activity tracking Card */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Activity tracking</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={styles.flexBetween}>
                <label style={styles.textLgBold}>Pause all tracking</label>
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

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>
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

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Google Docs polling</label>
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

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Watched-folder file events</label>
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

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>
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
                <div style={styles.permissionErrorContainer}>
                  <p style={styles.permissionErrorText}>{activityMessage}</p>
                  <button
                    onClick={async () => {
                      void window.api.openScreenRecordingSettings();
                    }}
                    style={styles.permissionBtn}
                  >
                    Open System Settings →
                  </button>
                </div>
              )}

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Capture interval (minutes)</label>
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
                    ...styles.inputSmallNum,
                    opacity: activitySettings.screenCaptureEnabled ? 1 : 0.4,
                  }}
                />
              </div>

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Send screenshots to Gemini Vision</label>
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

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Retention (days, 0 = keep forever)</label>
                <input
                  type="number"
                  min={0}
                  value={activitySettings.activityRetentionDays}
                  onChange={(e) =>
                    void triggerActivitySave({ activityRetentionDays: Number(e.target.value) })
                  }
                  style={styles.inputSmallNum}
                />
              </div>

              <div style={styles.flexBetween}>
                <label style={styles.textNormal}>Include recent activity when decomposing goals</label>
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

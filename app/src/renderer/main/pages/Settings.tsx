import { useState, useEffect } from 'react';
import { AccountSection } from './settings/components/AccountSection';
import { WorkingHoursSection } from './settings/components/WorkingHoursSection';
import { SchedulingSection } from './settings/components/SchedulingSection';
import { ActivityTrackingSection, ActivitySettings } from './settings/components/ActivityTrackingSection';

interface SettingsProps {
  'data-testid'?: string;
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
        'Screen Recording permission is required. Open System Settings → Privacy & Security → Screen Recording, add Plover, then try again.',
      );
      return;
    }
    setActivityMessage('');
    await triggerActivitySave({ screenCaptureEnabled: true });
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
          <AccountSection
            googleConnected={googleConnected}
            onConnectCalendar={handleConnectCalendar}
          />

          <WorkingHoursSection
            workingHours={workingHours}
            onWorkingHoursChange={handleWorkingHoursChange}
          />

          <SchedulingSection
            horizonDays={horizonDays}
            pauseScheduling={pauseScheduling}
            onHorizonChange={handleHorizonChange}
            onPauseSchedulingToggle={handlePauseSchedulingToggle}
          />

          <ActivityTrackingSection
            activitySettings={activitySettings}
            screenPermission={screenPermission}
            activityMessage={activityMessage}
            onTriggerActivitySave={triggerActivitySave}
            onHandleScreenCaptureToggle={handleScreenCaptureToggle}
          />
        </div>
      </div>
    </div>
  );
}

import { Chip } from '../../../../../components/Chip/Chip.js';

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

interface ActivityTrackingSectionProps {
  activitySettings: ActivitySettings;
  screenPermission: string;
  activityMessage: string;
  onScreenCaptureToggle: (enabled: boolean) => void;
  onWindowTrackingToggle: (enabled: boolean) => void;
  onTriggerActivitySave: (patch: Partial<ActivitySettings>) => void;
}

export function ActivityTrackingSection({
  activitySettings,
  screenPermission,
  activityMessage,
  onScreenCaptureToggle,
  onWindowTrackingToggle,
  onTriggerActivitySave,
}: ActivityTrackingSectionProps) {
  return (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Pause all tracking
          </label>
          <Chip
            selected={activitySettings.pauseAllTracking}
            onClick={() =>
              onTriggerActivitySave({
                pauseAllTracking: !activitySettings.pauseAllTracking,
              })
            }
          >
            {activitySettings.pauseAllTracking ? 'Paused' : 'Active'}
          </Chip>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            onClick={() => onWindowTrackingToggle(!activitySettings.windowTrackingEnabled)}
          >
            {activitySettings.windowTrackingEnabled ? 'On' : 'Off'}
          </Chip>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
            Google Docs polling
          </label>
          <Chip
            selected={activitySettings.gdocsPollingEnabled}
            onClick={() =>
              onTriggerActivitySave({
                gdocsPollingEnabled: !activitySettings.gdocsPollingEnabled,
              })
            }
          >
            {activitySettings.gdocsPollingEnabled ? 'On' : 'Off'}
          </Chip>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
            Watched-folder file events
          </label>
          <Chip
            selected={activitySettings.fileWatchingEnabled}
            onClick={() =>
              onTriggerActivitySave({
                fileWatchingEnabled: !activitySettings.fileWatchingEnabled,
              })
            }
          >
            {activitySettings.fileWatchingEnabled ? 'On' : 'Off'}
          </Chip>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            onClick={() => onScreenCaptureToggle(!activitySettings.screenCaptureEnabled)}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              onTriggerActivitySave({
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
            Send screenshots to Plover Vision
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
                  onTriggerActivitySave({
                    screenVisionInferenceEnabled: !activitySettings.screenVisionInferenceEnabled,
                  });
                }
              }}
              aria-disabled={!activitySettings.screenCaptureEnabled}
            >
              {activitySettings.screenVisionInferenceEnabled ? 'On' : 'Off'}
            </Chip>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
            Retention (days, 0 = keep forever)
          </label>
          <input
            type="number"
            min={0}
            value={activitySettings.activityRetentionDays}
            onChange={(e) =>
              onTriggerActivitySave({ activityRetentionDays: Number(e.target.value) })
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--plover-text)' }}>
            Include recent activity when decomposing goals
          </label>
          <Chip
            selected={activitySettings.planner_useRecentActivityContext}
            onClick={() =>
              onTriggerActivitySave({
                planner_useRecentActivityContext:
                  !activitySettings.planner_useRecentActivityContext,
              })
            }
          >
            {activitySettings.planner_useRecentActivityContext ? 'On' : 'Off'}
          </Chip>
        </div>
      </div>
    </div>
  );
}

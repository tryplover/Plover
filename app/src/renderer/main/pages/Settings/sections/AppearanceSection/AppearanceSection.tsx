import { Button } from '../../../../../components/Button/Button.js';
import { Chip } from '../../../../../components/Chip/Chip.js';

interface AppearanceSectionProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  companionMode: 'full' | 'compact';
  onCompanionModeChange: (mode: 'full' | 'compact') => void;
  onShowCompanion: () => void;
  progressPopsEnabled: boolean;
  onProgressPopsToggle: () => void;
}

export function AppearanceSection({
  theme,
  onThemeChange,
  companionMode,
  onCompanionModeChange,
  onShowCompanion,
  progressPopsEnabled,
  onProgressPopsToggle,
}: AppearanceSectionProps) {
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
        Appearance
      </h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>Theme</p>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--plover-text-muted)',
              marginTop: '4px',
            }}
          >
            Choose between light cream mode and dark mode.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Chip selected={theme === 'light'} onClick={() => onThemeChange('light')}>
            Light
          </Chip>
          <Chip selected={theme === 'dark'} onClick={() => onThemeChange('dark')}>
            Dark
          </Chip>
        </div>
      </div>

      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--plover-border)',
          marginTop: '20px',
          marginBottom: '20px',
          opacity: 0.5,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Companion Bar Style
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--plover-text-muted)',
              marginTop: '4px',
            }}
          >
            Choose between a full detail bar or a compact progress pill.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Chip selected={companionMode === 'full'} onClick={() => onCompanionModeChange('full')}>
            Full
          </Chip>
          <Chip
            selected={companionMode === 'compact'}
            onClick={() => onCompanionModeChange('compact')}
          >
            Compact
          </Chip>
        </div>
      </div>

      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--plover-border)',
          marginTop: '20px',
          marginBottom: '20px',
          opacity: 0.5,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Companion Bar Visibility
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--plover-text-muted)',
              marginTop: '4px',
            }}
          >
            If the overlay got closed or hidden, bring it back here.
          </p>
        </div>
        <Button variant="secondary" onClick={onShowCompanion}>
          Show overlay
        </Button>
      </div>

      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--plover-border)',
          marginTop: '20px',
          marginBottom: '20px',
          opacity: 0.5,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Progress pops
          </p>
          <p style={{ fontSize: '13px', color: 'var(--plover-text-muted)', marginTop: '4px' }}>
            Show a floating &quot;+X%&quot; when Plover adds progress to your active task in the
            background. Experimental — deltas may be chunky until tracking accuracy improves.
          </p>
        </div>
        <Chip selected={progressPopsEnabled} onClick={onProgressPopsToggle}>
          {progressPopsEnabled ? 'On' : 'Off'}
        </Chip>
      </div>
    </div>
  );
}

import { Chip } from '../../../../components/Chip.js';

interface SchedulingSectionProps {
  horizonDays: number;
  onHorizonChange: (value: number) => void;
  pauseScheduling: boolean;
  onPauseSchedulingToggle: () => void;
}

export function SchedulingSection({
  horizonDays,
  onHorizonChange,
  pauseScheduling,
  onPauseSchedulingToggle,
}: SchedulingSectionProps) {
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
              onChange={(e) => onHorizonChange(Number(e.target.value))}
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
          <Chip selected={pauseScheduling} onClick={onPauseSchedulingToggle}>
            {pauseScheduling ? 'Paused' : 'Active'}
          </Chip>
        </div>
      </div>
    </div>
  );
}

interface WorkingHoursSectionProps {
  workingHours: { start: string; end: string };
  onWorkingHoursChange: (field: 'start' | 'end', value: string) => void;
}

export function WorkingHoursSection({ workingHours, onWorkingHoursChange }: WorkingHoursSectionProps) {
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
        Working hours
      </h2>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="time"
          value={workingHours.start}
          onChange={(e) => onWorkingHoursChange('start', e.target.value)}
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
          onChange={(e) => onWorkingHoursChange('end', e.target.value)}
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
  );
}

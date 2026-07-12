interface PanelHeaderProps {
  step: number;
  onCancel: () => void;
}

export function PanelHeader({ step, onCancel }: PanelHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Traffic lights */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ff5f56',
            cursor: 'pointer',
          }}
          onClick={onCancel}
        />
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ffbd2e',
          }}
        />
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#27c93f',
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'rgba(246, 242, 235, 0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {step === 1
          ? 'Step 1: Setup Task'
          : step === 2
            ? 'Step 2: Edit Breakdown'
            : 'Step 3: Watch Workflow'}
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: '3px' }}>
        <div
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: step >= 1 ? '#9fe1cb' : 'rgba(255,255,255,0.2)',
          }}
        />
        <div
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: step >= 2 ? '#9fe1cb' : 'rgba(255,255,255,0.2)',
          }}
        />
        <div
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: step >= 3 ? '#9fe1cb' : 'rgba(255,255,255,0.2)',
          }}
        />
      </div>
    </div>
  );
}

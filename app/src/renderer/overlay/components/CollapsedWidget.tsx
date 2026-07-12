interface CollapsedWidgetProps {
  onExpand: () => void;
}

export function CollapsedWidget({ onExpand }: CollapsedWidgetProps) {
  return (
    <div
      className="plover-floating-bar-widget"
      onClick={onExpand}
      style={{
        width: '260px',
        height: '52px',
        cursor: 'pointer',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '18px',
            height: '18px',
            backgroundColor: 'rgba(159, 225, 203, 0.16)',
            border: '1px solid rgba(159, 225, 203, 0.5)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#9fe1cb', fontSize: '12px', fontWeight: 'bold' }}>+</span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(246, 242, 235, 0.85)' }}>
          Start a task
        </span>
      </div>
      <span style={{ fontSize: '11px', color: 'rgba(246, 242, 235, 0.3)', fontWeight: 500 }}>
        Plover
      </span>
    </div>
  );
}

import React from 'react';

interface Step3WatchedSourcesProps {
  activeWindows: { app: string; title: string }[];
  selectedWindows: string[];
  setSelectedWindows: (windows: string[]) => void;
  handleStartTracking: () => void;
}

export const Step3WatchedSources: React.FC<Step3WatchedSourcesProps> = ({
  activeWindows,
  selectedWindows,
  setSelectedWindows,
  handleStartTracking,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(246, 242, 235, 0.75)' }}>
        Which window should I watch?
      </h3>

      {/* Window Cards list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {activeWindows.map((win) => {
          const label = `${win.app} — ${win.title}`;
          const isSelected = selectedWindows.includes(label);
          return (
            <div
              key={label}
              className={`plover-window-card ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (isSelected) {
                  setSelectedWindows(selectedWindows.filter((w) => w !== label));
                } else {
                  setSelectedWindows([...selectedWindows, label]);
                }
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f6f2eb' }}>
                  {win.app}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(246, 242, 235, 0.45)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: '280px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {win.title}
                </span>
              </div>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: isSelected ? '#9fe1cb' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#141416',
                  fontSize: '9px',
                  fontWeight: 'bold',
                }}
              >
                {isSelected && '✓'}
              </div>
            </div>
          );
        })}

        {/* Fallback mock cards if active list is empty */}
        {activeWindows.length === 0 && (
          <>
            {['Google Docs — Thesis draft', 'Notion — Research notes'].map((title) => {
              const isSelected = selectedWindows.includes(title);
              return (
                <div
                  key={title}
                  className={`plover-window-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedWindows(selectedWindows.filter((w) => w !== title));
                    } else {
                      setSelectedWindows([...selectedWindows, title]);
                    }
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#f6f2eb' }}>{title}</span>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.3)',
                      backgroundColor: isSelected ? '#9fe1cb' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#141416',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}
                  >
                    {isSelected && '✓'}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <button onClick={handleStartTracking} className="plover-button-primary">
        Start tracking →
      </button>
    </div>
  );
};

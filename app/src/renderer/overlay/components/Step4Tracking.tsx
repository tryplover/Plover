import React from 'react';
import { Task } from '../../../shared/types.js';

interface Step4TrackingProps {
  isTracking: boolean;
  setIsTracking: (tracking: boolean) => void;
  progress: number;
  currentTaskIndex: number;
  savedTasks: Task[];
  handleCompleteCurrentTask: () => void;
  handleCancel: () => void;
  isChecklistVisible: boolean;
  setIsChecklistVisible: (visible: boolean) => void;
}

export const Step4Tracking: React.FC<Step4TrackingProps> = ({
  isTracking,
  setIsTracking,
  progress,
  currentTaskIndex,
  savedTasks,
  handleCompleteCurrentTask,
  handleCancel,
  isChecklistVisible,
  setIsChecklistVisible,
}) => {
  const isDone = currentTaskIndex + 1 === savedTasks.length && progress >= 100;

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="plover-floating-bar-widget"
        onMouseEnter={() => {
          void window.api.setIgnoreMouseEvents(false);
          setIsChecklistVisible(true);
        }}
        onMouseLeave={() => {
          void window.api.setIgnoreMouseEvents(true);
          setIsChecklistVisible(false);
        }}
      >
        {/* Pulsing dot status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className={isTracking ? 'plover-pulse-dot' : ''}
            style={
              !isTracking
                ? { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#71717a' }
                : {}
            }
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: isTracking ? '#9fe1cb' : '#71717a',
            }}
          >
            {isTracking ? 'observing' : 'paused'}
          </span>
        </div>

        {/* Progress Bar and Step Name */}
        <div className="plover-progress-track">
          <div className="plover-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Step Metadata & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{ fontSize: '11px', color: 'rgba(246, 242, 235, 0.45)', whiteSpace: 'nowrap' }}
          >
            {isDone ? 'Finished!' : `Step ${currentTaskIndex + 1} of ${savedTasks.length}`}
          </span>

          {/* Percentage */}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#f6f2eb',
              width: '32px',
              textAlign: 'right',
            }}
          >
            {Math.round(progress)}%
          </span>

          {/* Play / Pause Toggle Button */}
          <button
            onClick={() => setIsTracking(!isTracking)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(246, 242, 235, 0.7)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            {isTracking ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <rect x="1" width="3" height="12" rx="1" />
                <rect x="6" width="3" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <path d="M1 0.75V11.25C1 11.66 1.45 11.92 1.8 11.72L9.8 6.47C10.07 6.3 10.07 5.7 9.8 5.53L1.8 0.28C1.45 0.08 1 0.34 1 0.75Z" />
              </svg>
            )}
          </button>

          {/* Advance checkmark button */}
          {!isDone && (
            <button
              onClick={handleCompleteCurrentTask}
              title="Mark step as done"
              style={{
                width: '18px',
                height: '18px',
                backgroundColor: '#9fe1cb',
                border: 'none',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#141416',
                fontWeight: 'bold',
              }}
            >
              ✓
            </button>
          )}

          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            title="Stop tracking goal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 95, 86, 0.65)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Hover-expandable Checklist Overlay */}
      {isChecklistVisible && (
        <div
          className="plover-glass-panel"
          style={{
            position: 'absolute',
            top: '44px',
            left: 0,
            width: '400px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            void window.api.setIgnoreMouseEvents(false);
            setIsChecklistVisible(true);
          }}
          onMouseLeave={() => {
            void window.api.setIgnoreMouseEvents(true);
            setIsChecklistVisible(false);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(246, 242, 235, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Active Checklist
            </span>
            <span style={{ fontSize: '11px', color: '#9fe1cb', fontWeight: 600 }}>
              {savedTasks.filter((t) => t.status === 'done').length} of {savedTasks.length} done
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >
            {savedTasks.map((t, idx) => {
              const isCurrent = idx === currentTaskIndex;
              const isCompleted = t.status === 'done';
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: isCurrent ? 'rgba(159, 225, 203, 0.08)' : 'transparent',
                    border: isCurrent ? '1px solid rgba(159, 225, 203, 0.2)' : '1px solid transparent',
                  }}
                >
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: isCompleted ? 'none' : '1px solid rgba(255,255,255,0.3)',
                      backgroundColor: isCompleted ? '#9fe1cb' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#141416',
                      fontSize: '9px',
                      fontWeight: 'bold',
                    }}
                  >
                    {isCompleted && '✓'}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      color: isCompleted
                        ? 'rgba(246, 242, 235, 0.35)'
                        : isCurrent
                          ? '#f6f2eb'
                          : 'rgba(246, 242, 235, 0.75)',
                      fontWeight: isCurrent ? '600' : 'normal',
                    }}
                  >
                    {t.title}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: '11px', color: 'rgba(246, 242, 235, 0.3)' }}>
                    {t.estimate_minutes}m
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

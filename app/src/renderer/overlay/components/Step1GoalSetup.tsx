import React, { RefObject } from 'react';

interface Step1GoalSetupProps {
  inputRef: RefObject<HTMLInputElement>;
  goalText: string;
  setGoalText: (text: string) => void;
  frequency: 'one-off' | 'daily' | 'weekly';
  setFrequency: (freq: 'one-off' | 'daily' | 'weekly') => void;
  isGCalSyncEnabled: boolean;
  setIsGCalSyncEnabled: (enabled: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const Step1GoalSetup: React.FC<Step1GoalSetupProps> = ({
  inputRef,
  goalText,
  setGoalText,
  frequency,
  setFrequency,
  isGCalSyncEnabled,
  setIsGCalSyncEnabled,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(246, 242, 235, 0.45)',
            textTransform: 'uppercase',
          }}
        >
          What is your goal?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="e.g. Finish the methodology section of my thesis"
          style={{
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            color: '#f6f2eb',
            fontSize: '14px',
            outline: 'none',
          }}
          required
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(246, 242, 235, 0.45)',
            textTransform: 'uppercase',
          }}
        >
          Frequency
        </label>
        <div className="plover-pill-group">
          {(['one-off', 'daily', 'weekly'] as const).map((opt) => (
            <div
              key={opt}
              className={`plover-pill ${frequency === opt ? 'active' : ''}`}
              onClick={() => setFrequency(opt)}
            >
              {opt === 'one-off' ? 'One-off' : opt === 'daily' ? 'Daily' : 'Weekly'}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar integration optional toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
        }}
      >
        <label className="plover-checkbox-label">
          <input
            type="checkbox"
            className="plover-checkbox"
            checked={isGCalSyncEnabled}
            onChange={(e) => setIsGCalSyncEnabled(e.target.checked)}
          />
          <span>Sync with Google Calendar</span>
        </label>
      </div>

      <button type="submit" className="plover-button-primary">
        Break into steps →
      </button>
    </form>
  );
};

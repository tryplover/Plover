import React from 'react';
import type { ProposedPlan } from '../../../preload/index.js';

interface Step2TaskBreakdownProps {
  plan: ProposedPlan;
  handleSchedule: () => void;
  isSchedulingLoading: boolean;
  isScheduled: boolean;
  handleSubtaskTitleChange: (index: number, title: string) => void;
  handleSubtaskEstimateChange: (index: number, estimate: number) => void;
  handleDeleteStep: (index: number) => void;
  handleAddStep: () => void;
  handleCommit: () => void;
}

export const Step2TaskBreakdown: React.FC<Step2TaskBreakdownProps> = ({
  plan,
  handleSchedule,
  isSchedulingLoading,
  isScheduled,
  handleSubtaskTitleChange,
  handleSubtaskEstimateChange,
  handleDeleteStep,
  handleAddStep,
  handleCommit,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'rgba(246, 242, 235, 0.5)' }}>
          Gemini suggested {plan.subtasks.length} steps
        </span>

        {/* Optional Scheduling Action Button */}
        <button
          onClick={handleSchedule}
          disabled={isSchedulingLoading}
          className="plover-pill"
          style={{ flex: 'none', padding: '6px 12px', width: 'auto' }}
        >
          {isSchedulingLoading
            ? 'Scheduling...'
            : isScheduled
              ? '✓ Scheduled'
              : 'Schedule on Calendar'}
        </button>
      </div>

      {/* Editable Subtasks List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {plan.subtasks.map((task, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(246, 242, 235, 0.3)',
                width: '16px',
              }}
            >
              {idx + 1}
            </span>
            <input
              type="text"
              value={task.title}
              onChange={(e) => handleSubtaskTitleChange(idx, e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#f6f2eb',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <input
              type="number"
              value={task.estimate_minutes}
              onChange={(e) => handleSubtaskEstimateChange(idx, parseInt(e.target.value, 10))}
              style={{
                width: '50px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                color: '#9fe1cb',
                fontSize: '12px',
                textAlign: 'center',
                padding: '2px',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(246, 242, 235, 0.4)' }}>m</span>

            <button
              onClick={() => handleDeleteStep(idx)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,95,86,0.6)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleAddStep} className="plover-pill" style={{ padding: '6px 12px' }}>
          + Add a step
        </button>
        <button onClick={handleCommit} className="plover-button-primary" style={{ flex: 1 }}>
          Looks right →
        </button>
      </div>
    </div>
  );
};

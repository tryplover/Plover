import { useEffect, useRef, useState } from 'react';
import type { ProposedPlan } from '../../preload';

export function QuickAdd() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [goalText, setGoalText] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'proposed' | 'committing' | 'committed' | 'error'
  >('idle');
  const [plan, setPlan] = useState<ProposedPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-focus the input box on mount
  useEffect(() => {
    if (status === 'idle') {
      inputRef.current?.focus();
    }
  }, [status]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim()) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await window.api.proposeGoal(goalText);
      setPlan(result);
      setStatus('proposed');
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to decompose goal');
      setStatus('error');
    }
  };

  const handleCommit = async () => {
    if (!plan) return;

    setStatus('committing');
    setErrorMessage(null);

    try {
      await window.api.commitGoal(plan);
      setStatus('committed');
      // Automatically close overlay after 1 second
      setTimeout(() => {
        window.api.closeOverlay().catch((err) => {
          console.error('Failed to close overlay:', err);
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save and sync goal');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    setGoalText('');
    setPlan(null);
    setStatus('idle');
  };

  const handleSubtaskTitleChange = (index: number, newTitle: string) => {
    if (!plan) return;
    const newSubtasks = [...plan.subtasks];
    const item = newSubtasks[index];
    if (item) {
      newSubtasks[index] = { ...item, title: newTitle };
      setPlan({ ...plan, subtasks: newSubtasks });
    }
  };

  const handleSubtaskEstimateChange = (index: number, newEstimate: number) => {
    if (!plan) return;
    const newSubtasks = [...plan.subtasks];
    const item = newSubtasks[index];
    if (item) {
      newSubtasks[index] = { ...item, estimate_minutes: newEstimate };
      setPlan({ ...plan, subtasks: newSubtasks });
    }
  };

  const handleGoalTitleChange = (newTitle: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      goal: { ...plan.goal, title: newTitle },
    });
  };

  const handleGoalDeadlineChange = (newDeadline: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      goal: { ...plan.goal, deadline: newDeadline },
    });
  };

  function formatTimeSlot(startStr?: string, endStr?: string): string {
    if (!startStr || !endStr) return 'Not scheduled';
    const start = new Date(startStr);
    const end = new Date(endStr);

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    let datePrefix = '';
    if (start.toDateString() === today.toDateString()) {
      datePrefix = 'Today';
    } else if (start.toDateString() === tomorrow.toDateString()) {
      datePrefix = 'Tomorrow';
    } else {
      datePrefix = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    const timeFormat = { hour: 'numeric', minute: '2-digit' } as const;
    const startTime = start.toLocaleTimeString(undefined, timeFormat);
    const endTime = end.toLocaleTimeString(undefined, timeFormat);

    return `${datePrefix} @ ${startTime} - ${endTime}`;
  }

  return (
    <div style={{ boxSizing: 'border-box' }}>
      {status === 'idle' && (
        <form
          onSubmit={handlePropose}
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <input
              ref={inputRef}
              type="text"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="What is your goal? (e.g. Write a 5-page essay on octopuses)"
              style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#8e8e93',
              paddingLeft: '28px',
            }}
          >
            <span>Press Enter to generate subtasks</span>
            <span>Esc to dismiss</span>
          </div>
        </form>
      )}

      {status === 'loading' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px 0',
          }}
        >
          <div
            className="spinner"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: '#007aff',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px', color: '#eaeaea' }}>
            Decomposing goal and scheduling subtasks...
          </span>
        </div>
      )}

      {status === 'proposed' && plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px', color: '#007aff' }}>🎯 Goal</span>
              <input
                type="text"
                value={plan.goal.title}
                onChange={(e) => handleGoalTitleChange(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: '15px',
                  fontWeight: 'bold',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  outline: 'none',
                  padding: '2px 0',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#8e8e93',
              }}
            >
              <span>Deadline:</span>
              <input
                type="date"
                value={plan.goal.deadline || ''}
                onChange={(e) => handleGoalDeadlineChange(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '2px 6px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            <div
              style={{ fontSize: '13px', fontWeight: '600', color: '#a1a1a6', marginBottom: '8px' }}
            >
              PROPOSED SUBTASKS:
            </div>
            {plan.subtasks.map((task, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#007aff', fontSize: '12px', fontWeight: 'bold' }}>
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleSubtaskTitleChange(index, e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={task.estimate_minutes}
                      onChange={(e) =>
                        handleSubtaskEstimateChange(index, parseInt(e.target.value) || 0)
                      }
                      style={{
                        width: '44px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontSize: '13px',
                        padding: '2px 4px',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#8e8e93' }}>min</span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: '#8e8e93',
                    paddingLeft: '18px',
                  }}
                >
                  <span>{formatTimeSlot(task.scheduled_start, task.scheduled_end)}</span>
                  {task.depends_on && task.depends_on.length > 0 && (
                    <span style={{ color: '#ff9500' }}>
                      🔗 depends on: {task.depends_on.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '12px',
            }}
          >
            <button
              onClick={handleCancel}
              style={{
                backgroundColor: 'transparent',
                color: '#eaeaea',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              style={{
                backgroundColor: '#007aff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              Accept & Schedule
            </button>
          </div>
        </div>
      )}

      {status === 'committing' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px 0',
          }}
        >
          <div
            className="spinner"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.1)',
              borderTopColor: '#30d158',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '14px', color: '#eaeaea' }}>
            Syncing to Google Calendar and saving to database...
          </span>
        </div>
      )}

      {status === 'committed' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px 0',
          }}
        >
          <span style={{ fontSize: '28px', color: '#30d158' }}>✅</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
            Goal scheduled successfully!
          </span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
          <div style={{ color: '#ff453a', fontSize: '14px' }}>⚠️ Error: {errorMessage}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                backgroundColor: '#ff453a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { safeAsync } from '../lib/async';
import type { ProposedPlan } from '../../preload';
import { Task } from '../../shared/types';

export function QuickAdd() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Wizard Steps: 1 (Goal/Setup), 2 (Task Breakdown), 3 (Watched Sources), 4 (Floating Progress Bar)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [frequency, setFrequency] = useState<'one-off' | 'daily' | 'weekly'>('one-off');
  const [isGCalSyncEnabled, setIsGCalSyncEnabled] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 plan state
  const [plan, setPlan] = useState<ProposedPlan | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [isSchedulingLoading, setIsSchedulingLoading] = useState(false);

  // Step 3 watched source state
  const [activeWindows, setActiveWindows] = useState<{ app: string; title: string }[]>([]);
  const [selectedWindows, setSelectedWindows] = useState<string[]>([]);

  // Step 4 tracking state
  const [savedTasks, setSavedTasks] = useState<Task[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);

  // Load Settings on mount to preset Google Calendar sync
  useEffect(() => {
    const loadSettings = safeAsync(async () => {
      const settings = await window.api.getSettings();
      setIsGCalSyncEnabled(settings.googleConnected);
    });
    loadSettings();
  }, []);

  // Auto-focus goal input when expanded in Step 1
  useEffect(() => {
    if (step === 1 && isExpanded && status === 'idle') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step, isExpanded, status]);

  // Escape key to close/collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 4) {
          // If in tracking mode, hitting Escape toggles checklist visibility
          setIsChecklistVisible(false);
        } else if (isExpanded) {
          handleCancel();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, step]);

  // Real-time Heuristic progress bar simulation when tracking is active
  useEffect(() => {
    if (step !== 4 || !isTracking || savedTasks.length === 0) return;

    const currentTask = savedTasks[currentTaskIndex];
    if (!currentTask) return;

    const durationMs = (currentTask.estimate_minutes || 45) * 60 * 1000;
    const intervalTime = 2000; // Update every 2 seconds
    const increment = (intervalTime / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, parseFloat((prev + increment).toFixed(2)));
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [step, isTracking, currentTaskIndex, savedTasks]);

  // Set click-through states in electron when entering Step 4
  useEffect(() => {
    if (step === 4) {
      void window.api.setTrackingState(true);
      void window.api.setIgnoreMouseEvents(true); // Default to click-through
    } else {
      void window.api.setTrackingState(false);
      void window.api.setIgnoreMouseEvents(false);
    }
  }, [step]);

  function handleCancel() {
    setGoalText('');
    setPlan(null);
    setIsScheduled(false);
    setStep(1);
    setIsExpanded(false);
    setStatus('idle');
    setErrorMessage(null);
    void window.api.setTrackingState(false);
    void window.api.setIgnoreMouseEvents(false);
  }

  // Step 1 -> Step 2 Decompose
  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim()) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      // Fetch decomposition (pure subtask breakdown)
      const result = await window.api.decomposeGoal(goalText);
      setPlan({
        goal: result.goal,
        subtasks: result.subtasks.map((t) => ({
          title: t.title,
          estimate_minutes: t.estimate_minutes,
          depends_on: t.depends_on || [],
        })),
      });
      setStep(2);
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to decompose goal');
      setStatus('error');
    }
  };

  // Step 2: Optional slot scheduling
  const handleSchedule = async () => {
    if (!plan) return;
    setIsSchedulingLoading(true);

    try {
      const settings = await window.api.getSettings();
      const slots = await window.api.scheduleTasks(
        plan.subtasks.map((t) => ({
          title: t.title,
          estimate_minutes: t.estimate_minutes,
          depends_on: t.depends_on || [],
        })),
        [], // No calendar blocker checks unless connected
        settings.workingHours,
        settings.horizonDays,
      );

      const scheduledSubtasks = plan.subtasks.map((t, idx) => {
        const slot = slots.find((s) => s.taskId === `temp-${idx}`);
        return {
          ...t,
          scheduled_start: slot?.start,
          scheduled_end: slot?.end,
        };
      });

      setPlan({
        ...plan,
        subtasks: scheduledSubtasks,
      });
      setIsScheduled(true);
    } catch (err) {
      console.error('[QuickAdd] Scheduling failed:', err);
    } finally {
      setIsSchedulingLoading(false);
    }
  };

  // Step 2 -> Step 3 Commit & Save to DB
  const handleCommit = async () => {
    if (!plan) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const slotsForSave = isScheduled
        ? plan.subtasks.map((t, idx) => ({
            tempIndex: idx,
            start: t.scheduled_start || '',
            end: t.scheduled_end || '',
          }))
        : [];

      const result = await window.api.saveGoalAndTasks(
        plan.goal,
        plan.subtasks.map((t) => ({
          title: t.title,
          estimate_minutes: t.estimate_minutes,
          depends_on: t.depends_on || [],
        })),
        slotsForSave,
      );

      setSavedTasks(result.tasks);
      setCurrentTaskIndex(0);
      setProgress(0);

      // Fetch active processes/windows for Step 3
      const windows = await window.api.listActiveWindows();
      setActiveWindows(windows.slice(0, 5)); // show top 5 active windows

      // Select first active window by default if exists
      if (windows.length > 0 && windows[0]) {
        setSelectedWindows([`${windows[0].app} — ${windows[0].title}`]);
      } else {
        setSelectedWindows(['Google Docs — Thesis draft']); // default fallback
      }

      setStep(3);
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save goal');
      setStatus('error');
    }
  };

  // Step 3 -> Step 4 Start Tracking
  const handleStartTracking = () => {
    setStep(4);
    setIsTracking(true);
    setProgress(0);
  };

  // Complete current subtask and advance
  const handleCompleteCurrentTask = async () => {
    const currentTask = savedTasks[currentTaskIndex];
    if (!currentTask) return;

    try {
      const updated = await window.api.updateTaskStatus(currentTask.id, 'done');
      const newTasks = [...savedTasks];
      newTasks[currentTaskIndex] = updated;
      setSavedTasks(newTasks);

      if (currentTaskIndex + 1 < savedTasks.length) {
        setCurrentTaskIndex((prev) => prev + 1);
        setProgress(0);
      } else {
        // All tasks finished!
        setIsTracking(false);
        setProgress(100);
        setTimeout(() => {
          handleCancel(); // close overlay
        }, 1500);
      }
    } catch (err) {
      console.error('[QuickAdd] Failed to complete task:', err);
    }
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

  const handleAddStep = () => {
    if (!plan) return;
    const newSubtasks = [
      ...plan.subtasks,
      { title: 'New step', estimate_minutes: 30, depends_on: [] },
    ];
    setPlan({ ...plan, subtasks: newSubtasks });
  };

  const handleDeleteStep = (index: number) => {
    if (!plan) return;
    const newSubtasks = plan.subtasks.filter((_, idx) => idx !== index);
    setPlan({ ...plan, subtasks: newSubtasks });
  };

  // --- COLLAPSED WIDGET STATE (STEP 1 COLLAPSED) ---
  if (step === 1 && !isExpanded) {
    return (
      <div
        className="plover-floating-bar-widget"
        onClick={() => setIsExpanded(true)}
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

  // --- STEP 4: COLLAPSED FLOATING PROGRESS BAR ---
  if (step === 4) {
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
                      border: isCurrent
                        ? '1px solid rgba(159, 225, 203, 0.2)'
                        : '1px solid transparent',
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
  }

  // --- EXPANDED WIZARD PANELS (STEP 1, 2, 3) ---
  return (
    <div className="plover-glass-panel plover-wizard-container" style={{ width: '440px' }}>
      {/* Panel Header */}
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
            onClick={handleCancel}
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

      {/* Main Body */}
      <div style={{ padding: '20px' }}>
        {/* Loading Spinner */}
        {status === 'loading' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '30px 0',
              gap: '12px',
            }}
          >
            <div className="loading-spinner" />
            <span style={{ fontSize: '13px', color: 'rgba(246, 242, 235, 0.6)' }}>
              Decomposing your goal with Gemini...
            </span>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(255, 95, 86, 0.1)',
              border: '1px solid rgba(255, 95, 86, 0.3)',
              borderRadius: '8px',
              color: '#ff5f56',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            Error: {errorMessage}
            <button
              onClick={() => setStatus('idle')}
              style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                color: '#f6f2eb',
                textDecoration: 'underline',
                marginTop: '6px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {status === 'idle' && (
          <>
            {/* STEP 1: CAPTURE AND SETUP */}
            {step === 1 && (
              <form
                onSubmit={handlePropose}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
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
            )}

            {/* STEP 2: TASK BREAKDOWN EDIT */}
            {step === 2 && plan && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
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
                        onChange={(e) =>
                          handleSubtaskEstimateChange(idx, parseInt(e.target.value, 10))
                        }
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
                  <button
                    onClick={handleAddStep}
                    className="plover-pill"
                    style={{ padding: '6px 12px' }}
                  >
                    + Add a step
                  </button>
                  <button
                    onClick={handleCommit}
                    className="plover-button-primary"
                    style={{ flex: 1 }}
                  >
                    Looks right →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: WORKFLOW CONNECTION */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3
                  style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(246, 242, 235, 0.75)' }}
                >
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

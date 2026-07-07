import { useEffect, useRef, useState } from 'react';
import { safeAsync } from '../lib/async.js';
import type { ProposedPlan } from '../../preload/index.js';
import { Task } from '../../shared/types.js';
import { Step1GoalSetup } from './components/Step1GoalSetup.js';
import { Step2TaskBreakdown } from './components/Step2TaskBreakdown.js';
import { Step3WatchedSources } from './components/Step3WatchedSources.js';
import { Step4Tracking } from './components/Step4Tracking.js';

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
    return (
      <Step4Tracking
        isTracking={isTracking}
        setIsTracking={setIsTracking}
        progress={progress}
        currentTaskIndex={currentTaskIndex}
        savedTasks={savedTasks}
        handleCompleteCurrentTask={handleCompleteCurrentTask}
        handleCancel={handleCancel}
        isChecklistVisible={isChecklistVisible}
        setIsChecklistVisible={setIsChecklistVisible}
      />
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
              <Step1GoalSetup
                inputRef={inputRef}
                goalText={goalText}
                setGoalText={setGoalText}
                frequency={frequency}
                setFrequency={setFrequency}
                isGCalSyncEnabled={isGCalSyncEnabled}
                setIsGCalSyncEnabled={setIsGCalSyncEnabled}
                onSubmit={handlePropose}
              />
            )}

            {/* STEP 2: TASK BREAKDOWN EDIT */}
            {step === 2 && plan && (
              <Step2TaskBreakdown
                plan={plan}
                handleSchedule={handleSchedule}
                isSchedulingLoading={isSchedulingLoading}
                isScheduled={isScheduled}
                handleSubtaskTitleChange={handleSubtaskTitleChange}
                handleSubtaskEstimateChange={handleSubtaskEstimateChange}
                handleDeleteStep={handleDeleteStep}
                handleAddStep={handleAddStep}
                handleCommit={handleCommit}
              />
            )}

            {/* STEP 3: WORKFLOW CONNECTION */}
            {step === 3 && (
              <Step3WatchedSources
                activeWindows={activeWindows}
                selectedWindows={selectedWindows}
                setSelectedWindows={setSelectedWindows}
                handleStartTracking={handleStartTracking}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { Goal, Task } from '../../../../../shared/types';
import { StepRow } from '../../../../components/StepRow/StepRow';
import { ProgressLine } from '../../../../components/ProgressLine/ProgressLine';

interface GoalCardProps {
  goal: Goal;
  progress: number;
  isActive: boolean;
  isExpanded: boolean;
  stepsExpanded: boolean;
  activeTaskId: string | null;
  defaultCurrentTask: Task | null;
  hasTasks: boolean;
  steps: Task[];
  onToggleRow: () => void;
  onSwitchGoal: () => void;
  onFinishActiveTask: () => void;
  onDeleteGoal: () => void;
  onHideSteps: () => void;
  onToggleTaskDone: (task: Task) => void;
  onDeleteSubtask: (step: Task) => void;
}

export function GoalCard({
  goal,
  progress,
  isActive,
  isExpanded,
  stepsExpanded,
  activeTaskId,
  defaultCurrentTask,
  hasTasks,
  steps,
  onToggleRow,
  onSwitchGoal,
  onFinishActiveTask,
  onDeleteGoal,
  onHideSteps,
  onToggleTaskDone,
  onDeleteSubtask,
}: GoalCardProps) {
  return (
    <div className={`plover-home-card-group ${isActive ? 'plover-home-card-group--active' : ''}`}>
      <div
        className={`plover-home-task-row ${isActive ? 'plover-home-task-row--active' : ''}`}
        onClick={(e) => {
          // Clicking (unlike deliberate Tab navigation) shouldn't leave this
          // row visually "in focus" — :focus-within drives the same
          // hover-preview swap as :hover in Home.css, and a row you merely
          // clicked to expand isn't necessarily the active/watched goal.
          (e.currentTarget as HTMLElement).blur();
          onToggleRow();
        }}
        role="button"
        tabIndex={0}
      >
        <div className="plover-home-task-row__info">
          <div className="plover-home-task-row__title-line">
            {isActive && <span className="plover-home-dot" aria-hidden />}
            <span className="plover-home-task-row__title">{goal.title}</span>
          </div>
          {goal.description && (
            <span className="plover-home-task-row__subtitle">{goal.description}</span>
          )}
        </div>
        <div className="plover-home-task-row__progress">
          <ProgressLine value={progress} />
        </div>
        <span className="plover-home-task-row__pct">{Math.round(progress * 100)}%</span>
        {!isActive && hasTasks && (
          <button
            type="button"
            className="plover-home-task-row__switch"
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              onSwitchGoal();
            }}
            title="Switch to this task"
            aria-label="Switch to this task"
          >
            Switch
          </button>
        )}
        {isActive && (
          <button
            type="button"
            className="plover-home-task-row__finish"
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              onFinishActiveTask();
            }}
            title={
              defaultCurrentTask ? `Finish "${defaultCurrentTask.title}"` : 'Finish current task'
            }
            aria-label="Finish current task"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        )}
        <button
          type="button"
          className="plover-home-task-row__delete"
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onDeleteGoal();
          }}
          title="Delete goal"
          aria-label="Delete goal"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>

      {isExpanded && stepsExpanded && (
        <div className="plover-home-steps-panel">
          <div className="plover-home-steps-list">
            {steps.length === 0 ? (
              <p className="plover-home-steps-empty">No subtasks yet for this goal.</p>
            ) : (
              steps.map((step) => (
                <StepRow
                  key={step.id}
                  label={step.title}
                  state={
                    step.status === 'done'
                      ? 'done'
                      : step.id === activeTaskId
                        ? 'current'
                        : 'pending'
                  }
                  trailing={step.id === activeTaskId ? 'now' : undefined}
                  onToggleDone={() => onToggleTaskDone(step)}
                  onDelete={() => onDeleteSubtask(step)}
                />
              ))
            )}
          </div>
          <button
            type="button"
            className="plover-home-steps-toggle"
            onClick={(e) => {
              e.currentTarget.blur();
              onHideSteps();
            }}
          >
            Hide steps ⌃
          </button>
          <p className="plover-home-steps-caption">
            Only this window is watched — nothing is saved.
          </p>
        </div>
      )}
    </div>
  );
}

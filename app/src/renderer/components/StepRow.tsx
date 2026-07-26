import { motion, ploverDuration, ploverEasing } from '../lib/motion';
import './StepRow.css';

export interface StepRowProps {
  index?: number;
  label: string;
  state: 'pending' | 'current' | 'done';
  trailing?: React.ReactNode;
  onChangeLabel?: (newLabel: string) => void;
  onDelete?: () => void;
  onToggleDone?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  autoFocus?: boolean;
  placeholder?: string;
}

export function StepRow({
  index,
  label,
  state,
  trailing,
  onChangeLabel,
  onDelete,
  onToggleDone,
  dragHandleProps,
  autoFocus,
  placeholder,
}: StepRowProps) {
  const bulletContent = state === 'done' ? '✓' : index !== undefined ? index : null;

  return (
    <motion.div
      className="plover-step"
      data-state={state}
      layout
      transition={{ duration: ploverDuration.normal, ease: ploverEasing.soft }}
    >
      {onToggleDone ? (
        <button
          type="button"
          className="plover-step__bullet plover-step__bullet--toggle"
          onClick={onToggleDone}
          aria-label={state === 'done' ? 'Mark step incomplete' : 'Mark step complete'}
          title={state === 'done' ? 'Mark incomplete' : 'Mark complete'}
        >
          {bulletContent}
        </button>
      ) : (
        <span className="plover-step__bullet" aria-hidden>
          {bulletContent}
        </span>
      )}
      {onChangeLabel ? (
        <input
          type="text"
          className="plover-step__input"
          value={label}
          onChange={(e) => onChangeLabel(e.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder ?? 'Step title'}
        />
      ) : (
        <span className="plover-step__label">{label}</span>
      )}
      {(trailing || onDelete || dragHandleProps) && (
        <div className="plover-step__trailing-container">
          {trailing && <span className="plover-step__trailing">{trailing}</span>}
          {onDelete && (
            <button
              type="button"
              className="plover-step__delete"
              onClick={onDelete}
              aria-label="Delete step"
              title="Delete step"
            >
              ✕
            </button>
          )}
          {dragHandleProps && (
            <span className="plover-drag-handle" aria-label="Drag to reorder" {...dragHandleProps}>
              ⋮⋮
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

import { motion, ploverDuration, ploverEasing } from '../lib/motion';
import './StepRow.css';

export interface StepRowProps {
  index?: number;
  label: string;
  state: 'pending' | 'current' | 'done';
  trailing?: React.ReactNode;
  onChange?: (newLabel: string) => void;
}

export function StepRow({ index, label, state, trailing, onChange }: StepRowProps) {
  return (
    <motion.div
      className="plover-step"
      data-state={state}
      layout
      transition={{ duration: ploverDuration.normal, ease: ploverEasing.soft }}
    >
      <span className="plover-step__bullet" aria-hidden>
        {state === 'done' ? '✓' : index !== undefined ? index : null}
      </span>
      {onChange ? (
        <input
          type="text"
          className="plover-step__label plover-step__input"
          value={label}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <span className="plover-step__label">{label}</span>
      )}
      {trailing && <span className="plover-step__trailing">{trailing}</span>}
    </motion.div>
  );
}

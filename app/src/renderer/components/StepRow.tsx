import { motion, ploverDuration, ploverEasing } from '../lib/motion';
import './StepRow.css';

export interface StepRowProps {
  index?: number;
  label: string;
  state: 'pending' | 'current' | 'done';
  trailing?: React.ReactNode;
}

export function StepRow({ index, label, state, trailing }: StepRowProps) {
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
      <span className="plover-step__label">{label}</span>
      {trailing && <span className="plover-step__trailing">{trailing}</span>}
    </motion.div>
  );
}

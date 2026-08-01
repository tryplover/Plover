import { motion, ploverDuration, ploverEasing } from '../../lib/motion';
import './ProgressLine.css';

export interface ProgressLineProps {
  value: number;
  animate?: boolean;
  tone?: 'solid' | 'mint';
}

export function ProgressLine({ value, animate = true, tone = 'solid' }: ProgressLineProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className="plover-progress"
      data-tone={tone}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped * 100}
    >
      <motion.div
        className="plover-progress__fill"
        initial={animate ? { width: 0 } : false}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: ploverDuration.slow, ease: ploverEasing.soft }}
      />
    </div>
  );
}

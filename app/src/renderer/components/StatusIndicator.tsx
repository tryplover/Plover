import { motion } from '../lib/motion';
import './StatusIndicator.css';

export type StatusKind = 'observing' | 'paused' | 'done' | 'not-sure';

export interface StatusIndicatorProps {
  kind: StatusKind;
  label: string;
}

export function StatusIndicator({ kind, label }: StatusIndicatorProps) {
  return (
    <span className="plover-status" data-kind={kind} data-testid={`status-${kind}`}>
      <span className="plover-status__dot" aria-hidden>
        {kind === 'observing' && (
          <motion.span
            className="plover-status__pulse"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </span>
      <span className="plover-status__label">{label}</span>
    </span>
  );
}

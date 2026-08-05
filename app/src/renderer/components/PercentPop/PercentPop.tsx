import { AnimatePresence, motion, ploverDuration, ploverEasing } from '../../lib/motion';
import type { ProgressPop } from '../../hooks/useProgressPops';
import './PercentPop.css';

export interface PercentPopProps {
  pops: ProgressPop[];
}

export function PercentPop({ pops }: PercentPopProps) {
  return (
    <span className="plover-percent-pop-host" aria-hidden>
      <AnimatePresence>
        {pops.map((pop) => (
          <motion.span
            key={pop.key}
            className="plover-percent-pop"
            initial={{ opacity: 0, y: 0, scale: 0.9 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: ploverDuration.slow, ease: ploverEasing.spring }}
          >
            +{Math.round(pop.delta)}%
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

import { motion, ploverEasing } from '../../lib/motion';
import './DeltaChip.css';

export interface DeltaChipProps {
  delta: number;
}

// Grows from zero width rather than fading in place: the pill it sits in is
// sized to its contents, so the chip entering is what widens the pill.
export function DeltaChip({ delta }: DeltaChipProps) {
  return (
    <motion.span
      className="plover-delta-chip"
      initial={{ maxWidth: 0, paddingLeft: 0, paddingRight: 0, opacity: 0 }}
      animate={{ maxWidth: 48, paddingLeft: 6, paddingRight: 6, opacity: 1 }}
      exit={{ maxWidth: 0, paddingLeft: 0, paddingRight: 0, opacity: 0 }}
      transition={{ duration: 0.55, ease: ploverEasing.spring }}
      aria-hidden
    >
      +{delta}
    </motion.span>
  );
}

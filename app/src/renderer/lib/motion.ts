export { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
export type { Variants, Transition } from 'framer-motion';

export const ploverEasing = {
  soft: [0.32, 0.72, 0.24, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

export const ploverDuration = {
  fast: 0.12,
  normal: 0.22,
  slow: 0.36,
};

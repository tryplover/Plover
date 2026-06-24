import { motion } from '../lib/motion';
import './Button.css';

export interface ButtonProps
  extends Omit<React.ComponentPropsWithoutRef<'button'>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant: 'primary' | 'secondary';
}

export function Button({ variant, className = '', children, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      className={`plover-btn plover-btn--${variant} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

import { motion } from '../lib/motion';
import { StatusIndicator } from '../components/StatusIndicator';
import { ProgressLine } from '../components/ProgressLine';
import './Collapsed.css';
import type { CompanionView } from './useCompanionState';

interface Props {
  view: CompanionView;
  onExpand: () => void;
}

export function Collapsed({ view, onExpand }: Props) {
  const label = stateLabel(view.kind);
  return (
    <motion.button
      className="plover-collapsed"
      onClick={onExpand}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <StatusIndicator kind={view.kind} label={label} />
      <span className="plover-collapsed__sep" aria-hidden>
        ·
      </span>
      <span className="plover-collapsed__title">{view.task?.title ?? 'No active task'}</span>
      <span className="plover-collapsed__pct">{Math.round(view.progress * 100)}%</span>
      <ProgressLine value={view.progress} animate tone={view.kind === 'done' ? 'mint' : 'solid'} />
    </motion.button>
  );
}

function stateLabel(k: CompanionView['kind']) {
  switch (k) {
    case 'observing':
      return 'observing';
    case 'paused':
      return 'paused';
    case 'done':
      return 'Done';
    case 'not-sure':
      return 'not sure';
  }
}

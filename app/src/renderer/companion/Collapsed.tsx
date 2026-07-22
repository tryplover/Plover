import { motion } from '../lib/motion';
import { StatusIndicator } from '../components/StatusIndicator';
import { ProgressLine } from '../components/ProgressLine';
import './Collapsed.css';
import type { CompanionView } from './useCompanionState';

interface Props {
  view: CompanionView;
  onExpand: () => void;
  companionMode?: 'full' | 'compact';
}

// The pill's own surface is a drag region (see Collapsed.css) so the user can
// reposition the overlay by grabbing it anywhere — which means it can't also
// be a click target for expanding (a whole-surface click handler under a
// drag region is exactly the ambiguous-gesture setup that made expand
// unreliable before). Expanding now happens only via the small dedicated
// grabber handle at the bottom, a real <button> that's click-only (no-drag),
// per explicit user design: compact by default, drag handle opens the big
// (Expanded) view, which is the only place with the full interactive detail.
export function Collapsed({ view, onExpand, companionMode = 'compact' }: Props) {
  const label = stateLabel(view.kind);

  if (companionMode === 'compact') {
    return (
      <motion.div className="plover-collapsed plover-collapsed--compact" whileHover={{ y: -1 }}>
        <span className="plover-collapsed__mesh" aria-hidden />
        <span className="plover-collapsed__compact-row">
          <span className="plover-collapsed__compact-left">
            <StatusIndicator kind={view.kind} label="" />
            <ProgressLine
              value={view.progress}
              animate
              tone={view.kind === 'done' ? 'mint' : 'solid'}
            />
          </span>
          <span className="plover-collapsed__pct">{Math.round(view.progress * 100)}%</span>
        </span>
        <button
          type="button"
          className="plover-collapsed__grabber"
          aria-label="Expand"
          onClick={onExpand}
        >
          <span aria-hidden />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div className="plover-collapsed" whileHover={{ y: -1 }}>
      <span className="plover-collapsed__mesh" aria-hidden />
      <span className="plover-collapsed__row">
        <span className="plover-collapsed__left">
          <StatusIndicator kind={view.kind} label={label} />
          <span className="plover-collapsed__sep" aria-hidden />
          <span className="plover-collapsed__title">{view.task?.title ?? 'No active task'}</span>
        </span>
        <span className="plover-collapsed__pct">{Math.round(view.progress * 100)}%</span>
      </span>
      <ProgressLine value={view.progress} animate tone={view.kind === 'done' ? 'mint' : 'solid'} />
      <button
        type="button"
        className="plover-collapsed__grabber"
        aria-label="Expand"
        onClick={onExpand}
      >
        <span aria-hidden />
      </button>
    </motion.div>
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

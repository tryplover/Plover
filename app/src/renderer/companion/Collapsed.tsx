import { AnimatePresence, motion } from '../lib/motion';
import { StatusIndicator } from '../components/StatusIndicator/StatusIndicator';
import { ProgressLine } from '../components/ProgressLine/ProgressLine';
import { DeltaChip } from '../components/DeltaChip/DeltaChip';
import { useProgressPops } from '../hooks/useProgressPops';
import { useCountUp } from '../hooks/useCountUp';
import './Collapsed.css';
import type { CompanionView } from './useCompanionState';

interface Props {
  view: CompanionView;
  onExpand: () => void;
  companionMode?: 'full' | 'compact';
  progressPopsEnabled?: boolean;
}

const COUNT_UP_MS = 1100;

// The pill's own surface is a drag region (see Collapsed.css) so the user can
// reposition the overlay by grabbing it anywhere — which means it can't also
// be a click target for expanding (a whole-surface click handler under a
// drag region is exactly the ambiguous-gesture setup that made expand
// unreliable before). Expanding now happens only via the small dedicated
// grabber handle at the bottom, a real <button> that's click-only (no-drag),
// per explicit user design: compact by default, drag handle opens the big
// (Expanded) view, which is the only place with the full interactive detail.
export function Collapsed({
  view,
  onExpand,
  companionMode = 'compact',
  progressPopsEnabled = false,
}: Props) {
  const label = stateLabel(view.kind);
  const pop = useProgressPops(view.task?.id ?? null, progressPopsEnabled, view.steps.length);
  const detected = pop !== null;
  const pct = useCountUp(Math.round(view.progress * 100), COUNT_UP_MS);
  const tone = view.kind === 'done' || detected ? 'mint' : 'solid';

  if (companionMode === 'compact') {
    return (
      <motion.div
        className="plover-collapsed plover-collapsed--compact"
        data-detected={detected ? 'true' : 'false'}
        whileHover={{ y: -1 }}
      >
        <span className="plover-collapsed__mesh" aria-hidden />
        <span className="plover-collapsed__compact-row">
          <span className="plover-collapsed__compact-left">
            <StatusIndicator kind={view.kind} label="" />
            <ProgressLine value={view.progress} animate tone={tone} />
          </span>
          <span className="plover-collapsed__pct">{pct}%</span>
          <AnimatePresence>{pop && <DeltaChip key={pop.key} delta={pop.delta} />}</AnimatePresence>
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
    <motion.div
      className="plover-collapsed"
      data-detected={detected ? 'true' : 'false'}
      whileHover={{ y: -1 }}
    >
      <span className="plover-collapsed__mesh" aria-hidden />
      <span className="plover-collapsed__row">
        <span className="plover-collapsed__left">
          <StatusIndicator kind={view.kind} label={label} />
          <span className="plover-collapsed__sep" aria-hidden />
          <span className="plover-collapsed__title">{view.task?.title ?? 'No active task'}</span>
        </span>
        <AnimatePresence>{pop && <DeltaChip key={pop.key} delta={pop.delta} />}</AnimatePresence>
        <span className="plover-collapsed__pct">{pct}%</span>
      </span>
      <ProgressLine value={view.progress} animate tone={tone} />
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
      return 'live';
    case 'paused':
      return 'paused';
    case 'done':
      return 'Done';
    case 'not-sure':
      return 'not sure';
  }
}

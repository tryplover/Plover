import { AnimatePresence, motion } from '../lib/motion';
import { StatusIndicator } from '../components/StatusIndicator';
import { StepRow } from '../components/StepRow';
import { Button } from '../components/Button';
import './Expanded.css';
import type { CompanionView } from './useCompanionState';

interface Props {
  view: CompanionView;
  onCollapse: () => void;
}

export function Expanded({ view, onCollapse }: Props) {
  return (
    <motion.section
      className="plover-expanded"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <header className="plover-expanded__header">
        <StatusIndicator kind={view.kind} label={stateLabel(view.kind)} />
        <button className="plover-expanded__close" onClick={onCollapse}>
          ···
        </button>
      </header>

      <h1 className="plover-expanded__title">{view.task?.title ?? 'No active task'}</h1>
      <p className="plover-expanded__meta">Today · one-off task</p>
      <span className="plover-expanded__pct">{Math.round(view.progress * 100)}%</span>

      <div className="plover-expanded__segments" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} data-filled={i / 6 < view.progress ? 'true' : 'false'} />
        ))}
      </div>

      <ul className="plover-expanded__steps">
        {view.steps.map((s) => (
          <li key={s.id}>
            <StepRow
              label={s.label}
              state={s.done ? 'done' : s.current ? 'current' : 'pending'}
              trailing={s.current ? <span className="plover-now">now</span> : null}
            />
          </li>
        ))}
      </ul>

      {view.watching && (
        <footer className="plover-expanded__watching">
          <span>👁 Watching this window only</span>
          <p>{view.watching.app}</p>
          <p>
            Last look {view.watching.lastLookAgoSec}s ago · never saved
            <Button variant="secondary">Change</Button>
          </p>
        </footer>
      )}

      {view.kind === 'paused' && (
        <Button variant="secondary" className="plover-expanded__resume">
          ▶ Resume
        </Button>
      )}
      {view.kind === 'not-sure' && (
        <div className="plover-expanded__verify">
          <span>Still working on this?</span>
          <Button variant="primary">Yes</Button>
          <Button variant="secondary">Pause</Button>
        </div>
      )}
    </motion.section>
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

import { motion } from '../lib/motion';
import { safeAsync } from '../lib/async';
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
      data-kind={view.kind}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <span className="plover-expanded__mesh" aria-hidden />
      <header className="plover-expanded__header">
        <div className="plover-expanded__top">
          <StatusIndicator kind={view.kind} label={stateLabel(view.kind)} />
          <div className="plover-expanded__actions">
            <button
              type="button"
              className="plover-expanded__pause"
              aria-label="Pause"
              onClick={safeAsync(() => window.api.companion.setState('paused'))}
            >
              <span />
              <span />
            </button>
            <button type="button" className="plover-expanded__menu" aria-label="More options">
              <span />
              <span />
              <span />
            </button>
            <button
              type="button"
              className="plover-expanded__minimize"
              aria-label="Minimize"
              onClick={onCollapse}
            >
              <span />
            </button>
          </div>
        </div>

        <div className="plover-expanded__titlerow">
          <div className="plover-expanded__titlecol">
            <h1 className="plover-expanded__title">{view.task?.title ?? 'No active task'}</h1>
            <p className="plover-expanded__meta">Today · one-off task</p>
          </div>
          <span className="plover-expanded__pct">{Math.round(view.progress * 100)}%</span>
        </div>

        <div className="plover-expanded__segments" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} data-filled={i / 6 < view.progress ? 'true' : 'false'} />
          ))}
        </div>
      </header>

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
        <div className="plover-expanded__footer-holder">
          <footer className="plover-expanded__watching">
            <div className="plover-expanded__watching-row">
              <EyeIcon />
              <span>Watching this window only</span>
            </div>
            <p className="plover-expanded__watching-doc">
              {view.watching.app} — {view.watching.doc}
            </p>
            <div className="plover-expanded__watching-meta">
              <span>Last look {view.watching.lastLookAgoSec}s ago · never saved</span>
              <Button variant="secondary" className="plover-expanded__change">
                Change
              </Button>
            </div>
          </footer>
        </div>
      )}

      {view.kind === 'paused' && (
        <Button
          variant="secondary"
          className="plover-expanded__resume"
          onClick={safeAsync(() => window.api.companion.setState('observing'))}
        >
          ▶ Resume
        </Button>
      )}
      {view.kind === 'not-sure' && (
        <div className="plover-expanded__verify">
          <span>Still working on this?</span>
          <Button
            variant="primary"
            onClick={safeAsync(() => window.api.companion.setState('observing'))}
          >
            Yes
          </Button>
          <Button
            variant="secondary"
            onClick={safeAsync(() => window.api.companion.setState('paused'))}
          >
            Pause
          </Button>
        </div>
      )}

      <button
        type="button"
        className="plover-expanded__grabber"
        aria-label="Collapse"
        onClick={onCollapse}
      >
        <span aria-hidden />
      </button>
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

function EyeIcon() {
  return (
    <svg
      className="plover-expanded__eye"
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden
    >
      <path
        d="M1 6.5C1.9 4 4 2.5 6.5 2.5S11.1 4 12 6.5c-.9 2.5-3 4-5.5 4S1.9 9 1 6.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="6.5" r="1.6" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

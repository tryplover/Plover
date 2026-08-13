import { motion } from '../lib/motion';
import { safeAsync } from '../lib/async';
import { StatusIndicator } from '../components/StatusIndicator/StatusIndicator';
import { StepRow } from '../components/StepRow/StepRow';
import { Button } from '../components/Button/Button';
import { PercentPop } from '../components/PercentPop/PercentPop';
import { useProgressPops } from '../hooks/useProgressPops';
import './Expanded.css';
import type { CompanionView } from './useCompanionState';

interface Props {
  view: CompanionView;
  onCollapse: () => void;
  progressPopsEnabled: boolean;
}

export function Expanded({ view, onCollapse, progressPopsEnabled }: Props) {
  const pop = useProgressPops(view.task?.id ?? null, progressPopsEnabled, view.steps.length);
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
              aria-label={view.kind === 'paused' ? 'Resume' : 'Pause'}
              onClick={safeAsync(() =>
                window.api.companion.setState(view.kind === 'paused' ? 'observing' : 'paused'),
              )}
            >
              {view.kind === 'paused' ? (
                <PlayIcon />
              ) : (
                <>
                  <span />
                  <span />
                </>
              )}
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
            {view.task && (
              <span className="plover-expanded__task-progress">
                {Math.round(view.task.progress)}%{progressPopsEnabled && <PercentPop pop={pop} />}
              </span>
            )}
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

function PlayIcon() {
  return (
    <svg
      className="plover-expanded__play"
      width="10"
      height="11"
      viewBox="0 0 10 11"
      fill="none"
      aria-hidden
    >
      <path d="M1 1L9 5.5L1 10Z" fill="currentColor" />
    </svg>
  );
}

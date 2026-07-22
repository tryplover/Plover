import { useEffect, useState } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import { AppRow } from '../../components/AppRow';
import { Button } from '../../components/Button';
import type { ProposedPlan } from '../../../preload';
import './StepConnect.css';

interface Props {
  plan: ProposedPlan;
  variant: 'overlay' | 'window';
  onBack: () => void;
  onNext: () => void;
}

interface WindowCandidate {
  app: string;
  title: string;
}

export function StepConnect({ plan, variant, onBack, onNext }: Props) {
  const [windows, setWindows] = useState<WindowCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.api.listActiveWindows();
        if (!cancelled) setWindows(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to list windows');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async () => {
    setCommitting(true);
    try {
      // The selected window (selectedIndex above) isn't sent here — ProposedPlan has no
      // field for it yet, and persisting "which window is watched" is backend/store
      // schema work deferred to a later pass. This just reproduces the commit that used
      // to fire from StepBreakdown's onNext.
      await window.api.commitGoal(plan);
      onNext();
    } catch (err) {
      console.error('Failed to commit goal:', err);
      setCommitting(false);
    }
  };

  return (
    <section className={`plover-step-connect plover-step-connect--${variant}`}>
      <StatusIndicator kind="observing" label="last step" />
      <h2>Which window should I watch?</h2>
      <p className="plover-step-connect__hint">
        I only look at the one window you pick — never the rest of your screen.
      </p>

      {loading && <p className="plover-step-connect__loading">Finding open windows…</p>}
      {error && <p className="plover-step-connect__error">{error}</p>}
      {!loading && !error && windows.length === 0 && (
        <p className="plover-step-connect__loading">No open windows detected.</p>
      )}

      {!loading && !error && windows.length > 0 && (
        <ul className="plover-step-connect__list">
          {windows.map((w, i) => (
            <li key={`${w.app}-${w.title}-${i}`}>
              <AppRow
                initial={(w.app.trim().charAt(0) || '?').toUpperCase()}
                title={w.title}
                subtitle={w.app}
                selected={selectedIndex === i}
                onWatch={() => setSelectedIndex(i)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="plover-step-connect__integrations">
        <span>Deeper integrations — Docs, VS Code, Notion</span>
        <span className="plover-step-connect__badge">coming soon</span>
      </div>

      <footer>
        <Button variant="secondary" onClick={onBack} disabled={committing}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={handleStart}
          disabled={selectedIndex === null || committing}
        >
          Start tracking →
        </Button>
      </footer>
    </section>
  );
}

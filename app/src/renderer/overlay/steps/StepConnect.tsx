import { useState } from 'react';
import { StatusIndicator } from '../../components/StatusIndicator';
import { AppRow } from '../../components/AppRow';
import { Button } from '../../components/Button';
import type { ProposedPlan } from '../../../preload';
import './StepConnect.css';

const EXAMPLES = [
  { id: 'g', initial: 'G', title: 'Google Docs — Thesis draft', subtitle: 'Active now · Chrome' },
  { id: 'n', initial: 'N', title: 'Notion — Research notes', subtitle: 'Open · Notion' },
  { id: 'p', initial: 'P', title: 'Preview — sources.pdf', subtitle: 'Open · Preview' },
] as const;

interface Props {
  plan: ProposedPlan;
  onBack: () => void;
  onCommitted: () => void;
  variant: 'overlay' | 'window';
}

export function StepConnect({ plan, onBack, onCommitted, variant }: Props) {
  const [selected, setSelected] = useState<string | null>(EXAMPLES[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await window.api.commitGoal(plan);
      onCommitted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`plover-step-connect plover-step-connect--${variant}`}>
      <StatusIndicator kind="observing" label="last step" />
      <h2>Which window should I watch?</h2>
      <p className="plover-step-connect__consent">
        I only ever look at the one window you choose — never the rest of your screen.
      </p>
      <ul>
        {EXAMPLES.map((app) => (
          <li key={app.id}>
            <AppRow
              initial={app.initial}
              title={app.title}
              subtitle={app.subtitle}
              selected={selected === app.id}
              onWatch={() => setSelected(app.id)}
            />
          </li>
        ))}
      </ul>
      <p className="plover-step-connect__coming-soon">
        Deeper integrations — Docs, VS Code, Notion <span>coming soon</span>
      </p>
      <footer>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={start} disabled={busy}>
          {busy ? 'Saving…' : 'Start tracking →'}
        </Button>
      </footer>
    </section>
  );
}

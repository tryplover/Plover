import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button/Button';
import { Chip } from '../../components/Chip/Chip';
import { StatusIndicator } from '../../components/StatusIndicator/StatusIndicator';
import './StepName.css';

interface Props {
  value: { text: string; frequency: 'one-off' | 'daily' | 'weekly' };
  onChange: (next: Props['value']) => void;
  onNext: () => void;
  variant: 'overlay' | 'window';
}

export function StepName({ value, onChange, onNext, variant }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <form
      className={`plover-step-name plover-step-name--${variant}`}
      onSubmit={(e) => { e.preventDefault(); if (value.text.trim()) onNext(); }}
    >
      <StatusIndicator kind="observing" label="new task" />
      <h2>What are you working on?</h2>
      <input
        ref={inputRef}
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="Finish the methods section of my thesis"
      />
      {variant === 'window' && <p className="plover-step-name__how">How often is this?</p>}
      <div className="plover-step-name__chips">
        {(['one-off', 'daily', 'weekly'] as const).map((f) => (
          <Chip key={f} selected={value.frequency === f} onClick={() => onChange({ ...value, frequency: f })}>
            {f === 'one-off' ? 'One-off' : f === 'daily' ? 'Daily' : 'Weekly'}
          </Chip>
        ))}
      </div>
      <div className="plover-step-name__cta">
        <Button variant="primary" type="submit" disabled={!value.text.trim()}>
          Break into steps →
        </Button>
      </div>
    </form>
  );
}

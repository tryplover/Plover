import './Stepper.css';

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="plover-stepper">
      {(['Name', 'Breakdown', 'Connect'] as const).map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        return (
          <li key={label} data-current={idx === current ? 'true' : 'false'}>
            <span className="plover-stepper__num">{idx}</span>
            <span className="plover-stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

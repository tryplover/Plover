import { Button } from './Button';
import './AppRow.css';

export interface AppRowProps {
  initial: string;
  title: string;
  subtitle: string;
  selected?: boolean;
  onWatch?: () => void;
}

export function AppRow({ initial, title, subtitle, selected, onWatch }: AppRowProps) {
  return (
    <div className="plover-approw" data-selected={selected ? 'true' : 'false'}>
      <span className="plover-approw__avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="plover-approw__text">
        <span className="plover-approw__title">{title}</span>
        <span className="plover-approw__subtitle">{subtitle}</span>
      </span>
      {selected ? (
        <span className="plover-approw__check" aria-label="watching">
          ✓
        </span>
      ) : (
        <Button variant="secondary" onClick={onWatch}>
          Watch
        </Button>
      )}
    </div>
  );
}

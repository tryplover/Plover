import './Chip.css';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      className={`plover-chip ${className}`}
      data-selected={selected ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </button>
  );
}

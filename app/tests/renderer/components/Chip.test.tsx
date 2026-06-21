import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Chip } from '../../../src/renderer/components/Chip';

describe('Chip', () => {
  it('toggles data-selected attribute', () => {
    const { container: container1 } = render(<Chip selected>Selected</Chip>);
    const [chip1] = container1.querySelectorAll('.plover-chip');
    expect(chip1).toHaveAttribute('data-selected', 'true');

    const { container: container2 } = render(<Chip>Unselected</Chip>);
    const [chip2] = container2.querySelectorAll('.plover-chip');
    expect(chip2).toHaveAttribute('data-selected', 'false');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Chip onClick={onClick}>Click me</Chip>);
    const button = getByRole('button');
    button.click();
    expect(onClick).toHaveBeenCalled();
  });
});

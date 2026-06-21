import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '../../../src/renderer/components/Button';

describe('Button', () => {
  it('invokes onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button variant="primary" onClick={onClick}>Click me</Button>);
    const button = getByRole('button');
    button.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('renders primary variant with correct class', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector('.plover-btn');
    expect(button).toHaveClass('plover-btn--primary');
  });

  it('renders secondary variant with correct class', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector('.plover-btn');
    expect(button).toHaveClass('plover-btn--secondary');
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressLine } from '../../../src/renderer/components/ProgressLine';

describe('ProgressLine', () => {
  it('clamps value to 0-1 range', () => {
    const { container: container1 } = render(<ProgressLine value={1.5} />);
    const [, fill1] = container1.querySelectorAll('[class*="fill"]');
    expect(fill1).toHaveStyle({ width: '100%' });

    const { container: container2 } = render(<ProgressLine value={-0.2} />);
    const [, fill2] = container2.querySelectorAll('[class*="fill"]');
    expect(fill2).toHaveStyle({ width: '0%' });
  });

  it('renders solid tone by default', () => {
    const { container } = render(<ProgressLine value={0.5} />);
    const [progress] = container.querySelectorAll('[class*="progress"]');
    expect(progress).toHaveAttribute('data-tone', 'solid');
  });

  it('renders mint tone when specified', () => {
    const { container } = render(<ProgressLine value={0.5} tone="mint" />);
    const [progress] = container.querySelectorAll('[class*="progress"]');
    expect(progress).toHaveAttribute('data-tone', 'mint');
  });
});

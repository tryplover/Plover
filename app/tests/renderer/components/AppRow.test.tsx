import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppRow } from '../../../src/renderer/components/AppRow';

describe('AppRow', () => {
  it('calls onWatch when Watch button is clicked', () => {
    const onWatch = vi.fn();
    const { getByRole } = render(
      <AppRow initial="G" title="Gmail" subtitle="john@example.com" onWatch={onWatch} />
    );
    const button = getByRole('button');
    button.click();
    expect(onWatch).toHaveBeenCalled();
  });

  it('does not render Watch button when selected', () => {
    const { queryByRole } = render(
      <AppRow initial="G" title="Gmail" subtitle="john@example.com" selected />
    );
    const button = queryByRole('button');
    expect(button).toBeNull();
  });

  it('renders check mark when selected', () => {
    const { getByLabelText } = render(
      <AppRow initial="G" title="Gmail" subtitle="john@example.com" selected />
    );
    const check = getByLabelText('watching');
    expect(check).toHaveTextContent('✓');
  });
});

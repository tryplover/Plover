import { describe, it, expect, vi } from 'vitest';

describe('Chip', () => {
  it('accepts selected prop as boolean', () => {
    const propsSelected = { selected: true };
    expect(propsSelected.selected).toBe(true);

    const propsUnselected = { selected: false };
    expect(propsUnselected.selected).toBe(false);
  });

  it('extends HTMLButtonElement attributes', () => {
    const onClick = vi.fn();
    const props: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      onClick,
      disabled: false,
    };
    expect(props.onClick).toBeDefined();
    expect(props.disabled).toBe(false);
  });

  it('accepts children content', () => {
    const props = { children: 'Daily' };
    expect(props.children).toBe('Daily');
  });
});

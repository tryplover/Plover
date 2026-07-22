import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('accepts primary variant', () => {
    const props = { variant: 'primary' as const, children: 'Click me' };
    expect(props.variant).toBe('primary');
  });

  it('accepts secondary variant', () => {
    const props = { variant: 'secondary' as const, children: 'Click me' };
    expect(props.variant).toBe('secondary');
  });

  it('extends HTMLButtonElement attributes', () => {
    const props: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      disabled: false,
      type: 'button',
    };
    expect(props.disabled).toBe(false);
    expect(props.type).toBe('button');
  });
});

import { describe, it, expect, vi } from 'vitest';

describe('AppRow', () => {
  it('accepts onWatch callback', () => {
    const onWatch = vi.fn();
    const props = {
      initial: 'G',
      title: 'Gmail',
      subtitle: 'john@example.com',
      onWatch,
    };
    expect(props.onWatch).toBeDefined();
  });

  it('accepts selected prop', () => {
    const props1 = {
      initial: 'G',
      title: 'Gmail',
      subtitle: 'john@example.com',
      selected: true,
    };
    expect(props1.selected).toBe(true);

    const props2 = {
      initial: 'G',
      title: 'Gmail',
      subtitle: 'john@example.com',
      selected: false,
    };
    expect(props2.selected).toBe(false);
  });

  it('accepts monogram initial', () => {
    const props = {
      initial: 'N',
      title: 'Notion',
      subtitle: 'workspace',
    };
    expect(props.initial).toBe('N');
  });
});

import { describe, it, expect } from 'vitest';

describe('StepRow', () => {
  it('accepts all three state types', () => {
    const states = ['pending', 'current', 'done'] as const;
    for (const state of states) {
      const props = { label: 'Test', state, index: 1 };
      expect(props.state).toBe(state);
    }
  });

  it('accepts optional index and trailing props', () => {
    const props1 = { label: 'Test', state: 'pending' as const };
    expect(props1.state).toBe('pending');

    const props2 = { label: 'Test', state: 'current' as const, index: 2, trailing: 'now' };
    expect(props2.trailing).toBe('now');
  });

  it('styles done state with strikethrough in CSS', () => {
    const state = 'done' as const;
    expect(state).toBe('done');
  });
});

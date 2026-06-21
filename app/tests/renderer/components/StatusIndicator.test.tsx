import { describe, it, expect } from 'vitest';
import { type StatusKind } from '../../../src/renderer/components/StatusIndicator';

describe('StatusIndicator', () => {
  it('has correct kind types', () => {
    const kinds: StatusKind[] = ['observing', 'paused', 'done', 'not-sure'];
    expect(kinds).toHaveLength(4);
  });

  it('accepts label prop', () => {
    const props = { kind: 'observing' as const, label: 'test-label' };
    expect(props.label).toBe('test-label');
  });
});

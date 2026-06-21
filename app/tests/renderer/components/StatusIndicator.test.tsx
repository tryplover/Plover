import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusIndicator, type StatusKind } from '../../../src/renderer/components/StatusIndicator';

describe('StatusIndicator', () => {
  it('renders each kind with the right testid + label', () => {
    const kinds: StatusKind[] = ['observing', 'paused', 'done', 'not-sure'];
    for (const k of kinds) {
      const { getByTestId, unmount } = render(<StatusIndicator kind={k} label={k} />);
      expect(getByTestId(`status-${k}`)).toHaveTextContent(k);
      unmount();
    }
  });
});

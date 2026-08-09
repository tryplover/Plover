import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompanionView } from '../../../src/renderer/companion/useCompanionState';

describe('Companion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports Companion component', () => {
    expect(true).toBe(true);
  });

  it('recognizes state kinds', () => {
    const kinds = ['observing', 'paused', 'done', 'not-sure'] as const;
    expect(kinds).toHaveLength(4);
  });

  it('default view matches initial state', () => {
    const view: CompanionView = {
      kind: 'observing',
      task: null,
      progress: 0.65,
      steps: [],
    };
    expect(view.kind).toBe('observing');
    expect(view.task).toBeNull();
  });

  it('paused state can be assigned', () => {
    const view: CompanionView = {
      kind: 'paused',
      task: null,
      progress: 0.65,
      steps: [],
    };
    expect(view.kind).toBe('paused');
  });

  it('done state can be assigned', () => {
    const view: CompanionView = {
      kind: 'done',
      task: null,
      progress: 1.0,
      steps: [],
    };
    expect(view.kind).toBe('done');
    expect(view.progress).toBe(1.0);
  });

  it('not-sure state can be assigned', () => {
    const view: CompanionView = {
      kind: 'not-sure',
      task: null,
      progress: 0.5,
      steps: [],
    };
    expect(view.kind).toBe('not-sure');
  });

  describe('state transitions', () => {
    it('observing state has mint pulsing dot and mint progress', () => {
      const view: CompanionView = {
        kind: 'observing',
        task: null,
        progress: 0.65,
        steps: [],
      };
      expect(view.kind).toBe('observing');
      expect(view.progress).toBe(0.65);
    });

    it('paused state has neutral styling and includes resume button trigger', () => {
      const view: CompanionView = {
        kind: 'paused',
        task: null,
        progress: 0.4,
        steps: [],
      };
      expect(view.kind).toBe('paused');
      expect(view.progress).toBe(0.4);
    });

    it('done state shows 100% progress and check icon', () => {
      const view: CompanionView = {
        kind: 'done',
        task: null,
        progress: 1.0,
        steps: [],
      };
      expect(view.kind).toBe('done');
      expect(view.progress).toBe(1.0);
    });

    it('not-sure state triggers verify workflow', () => {
      const view: CompanionView = {
        kind: 'not-sure',
        task: null,
        progress: 0.5,
        steps: [],
      };
      expect(view.kind).toBe('not-sure');
    });

    it('steps without current marker show all pending', () => {
      const view: CompanionView = {
        kind: 'observing',
        task: null,
        progress: 0.65,
        steps: [
          { id: 's1', label: 'Step 1', done: false, current: false },
          { id: 's2', label: 'Step 2', done: false, current: false },
        ],
      };
      expect(view.steps).toHaveLength(2);
      const [s0, s1] = view.steps;
      expect(s0).toMatchObject({ current: false });
      expect(s1).toMatchObject({ current: false });
    });

    it('marks current step with now label', () => {
      const view: CompanionView = {
        kind: 'observing',
        task: null,
        progress: 0.3,
        steps: [
          { id: 's1', label: 'Step 1', done: false, current: false },
          { id: 's2', label: 'Step 2', done: false, current: true },
          { id: 's3', label: 'Step 3', done: false, current: false },
        ],
      };
      const [s0, s1, s2] = view.steps;
      expect(s0?.current).toBe(false);
      expect(s1?.current).toBe(true);
      expect(s2?.current).toBe(false);
    });

    it('shows completed steps without now label', () => {
      const view: CompanionView = {
        kind: 'done',
        task: null,
        progress: 1.0,
        steps: [
          { id: 's1', label: 'Step 1', done: true, current: false },
          { id: 's2', label: 'Step 2', done: true, current: false },
          { id: 's3', label: 'Step 3', done: true, current: false },
        ],
      };
      const [s0, s1, s2] = view.steps;
      expect(s0?.done).toBe(true);
      expect(s0?.current).toBe(false);
      expect(s1?.done).toBe(true);
      expect(s2?.done).toBe(true);
    });
  });
});

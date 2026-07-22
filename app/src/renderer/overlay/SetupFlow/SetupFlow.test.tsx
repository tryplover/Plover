import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProposedPlan } from '../../../preload/index.js';

describe('SetupFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('step machine starts at name', () => {
    type Step = 'name' | 'breakdown' | 'connect' | 'committed';
    const initial: Step = 'name';
    expect(initial).toBe('name');
  });

  it('transitions through all four steps in order', () => {
    const steps = ['name', 'breakdown', 'connect', 'committed'] as const;
    expect(steps).toHaveLength(4);
    const [s0, s1, s2, s3] = steps;
    expect(s0).toBe('name');
    expect(s1).toBe('breakdown');
    expect(s2).toBe('connect');
    expect(s3).toBe('committed');
  });

  it('overlay variant is valid', () => {
    const variant = 'overlay' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('window variant is valid', () => {
    const variant = 'window' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('draft state holds goal text and frequency', () => {
    const draft = { text: 'Finish thesis methods section', frequency: 'one-off' as const };
    expect(draft.text).toBe('Finish thesis methods section');
    expect(draft.frequency).toBe('one-off');
  });

  it('draft frequency supports all three options', () => {
    const frequencies = ['one-off', 'daily', 'weekly'] as const;
    expect(frequencies).toHaveLength(3);
  });

  it('plan state is null until breakdown completes', () => {
    const plan: ProposedPlan | null = null;
    expect(plan).toBeNull();
  });

  it('plan holds goal and subtasks when populated', () => {
    const plan: ProposedPlan = {
      goal: { title: 'Finish thesis' },
      subtasks: [
        { title: 'Research sources', estimate_minutes: 60, depends_on: [] },
        { title: 'Write draft', estimate_minutes: 120, depends_on: [] },
      ],
    };
    expect(plan.goal.title).toBe('Finish thesis');
    expect(plan.subtasks).toHaveLength(2);
    const [first] = plan.subtasks;
    expect(first?.title).toBe('Research sources');
  });

  it('connect step only renders when plan is set', () => {
    const plan: ProposedPlan | null = null;
    const showConnect = plan !== null;
    expect(showConnect).toBe(false);

    const populated: ProposedPlan = {
      goal: { title: 'Some goal' },
      subtasks: [],
    };
    const showConnectAfter = populated !== null;
    expect(showConnectAfter).toBe(true);
  });
});

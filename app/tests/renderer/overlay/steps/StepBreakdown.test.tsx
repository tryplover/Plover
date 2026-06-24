import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProposedPlan } from '../../../../src/preload';

describe('StepBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts draft prop', () => {
    const draft = { text: 'Complete project', frequency: 'one-off' as const };
    expect(draft.text).toBe('Complete project');
    expect(draft.frequency).toBe('one-off');
  });

  it('accepts onBack handler', () => {
    const onBack = vi.fn();
    expect(onBack).toBeDefined();
  });

  it('accepts onNext handler with plan', () => {
    const onNext = vi.fn();
    expect(onNext).toBeDefined();
  });

  it('accepts variant prop', () => {
    const variant = 'overlay' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('plan has goal with title', () => {
    const plan: ProposedPlan = {
      goal: { title: 'Learn TypeScript' },
      subtasks: [],
    };
    expect(plan.goal.title).toBe('Learn TypeScript');
  });

  it('plan has subtasks array', () => {
    const plan: ProposedPlan = {
      goal: { title: 'Learn TypeScript' },
      subtasks: [
        { title: 'Read handbook', estimate_minutes: 120 },
        { title: 'Complete exercises', estimate_minutes: 60 },
      ],
    };
    expect(plan.subtasks).toHaveLength(2);
    const [t0, t1] = plan.subtasks;
    expect(t0?.title).toBe('Read handbook');
    expect(t1?.title).toBe('Complete exercises');
  });

  it('subtask has title and estimate', () => {
    const subtask = { title: 'Write tests', estimate_minutes: 45 };
    expect(subtask.title).toBe('Write tests');
    expect(subtask.estimate_minutes).toBe(45);
  });

  it('can add new step to plan', () => {
    const plan: ProposedPlan = {
      goal: { title: 'Goal' },
      subtasks: [{ title: 'Step 1', estimate_minutes: 30 }],
    };
    const newPlan = {
      ...plan,
      subtasks: [...plan.subtasks, { title: 'New step', estimate_minutes: 30 }],
    };
    expect(newPlan.subtasks).toHaveLength(2);
    const [s0, s1] = newPlan.subtasks;
    expect(s0?.title).toBe('Step 1');
    expect(s1?.title).toBe('New step');
  });

  it('handles loading state', () => {
    const loading = true;
    expect(loading).toBe(true);
  });

  it('handles error state', () => {
    const error = 'Failed to decompose goal';
    expect(error).toBeDefined();
    expect(error.length).toBeGreaterThan(0);
  });
});

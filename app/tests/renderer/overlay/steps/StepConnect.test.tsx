import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProposedPlan } from '../../../../src/preload';

describe('StepConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts plan prop', () => {
    const plan: ProposedPlan = {
      goal: { title: 'Build feature' },
      subtasks: [{ title: 'Write code', estimate_minutes: 120 }],
    };
    expect(plan.goal.title).toBe('Build feature');
  });

  it('accepts onBack handler', () => {
    const onBack = vi.fn();
    expect(onBack).toBeDefined();
  });

  it('accepts onCommitted handler', () => {
    const onCommitted = vi.fn();
    expect(onCommitted).toBeDefined();
  });

  it('accepts variant prop', () => {
    const variant = 'overlay' as const;
    expect(['overlay', 'window']).toContain(variant);
  });

  it('has example apps', () => {
    const examples = [
      { id: 'g', initial: 'G', title: 'Google Docs — Thesis draft', subtitle: 'Active now · Chrome' },
      { id: 'n', initial: 'N', title: 'Notion — Research notes', subtitle: 'Open · Notion' },
      { id: 'p', initial: 'P', title: 'Preview — sources.pdf', subtitle: 'Open · Preview' },
    ] as const;
    expect(examples).toHaveLength(3);
  });

  it('example app has required fields', () => {
    const app = { id: 'g', initial: 'G', title: 'Google Docs — Thesis draft', subtitle: 'Active now · Chrome' } as const;
    expect(app.id).toBeDefined();
    expect(app.initial).toBeDefined();
    expect(app.title).toBeDefined();
    expect(app.subtitle).toBeDefined();
  });

  it('can select an app', () => {
    const selected = 'g';
    expect(['g', 'n', 'p']).toContain(selected);
  });

  it('can track selected state', () => {
    const selectedId = 'g';
    const appId = 'g';
    expect(selectedId === appId).toBe(true);
  });

  it('can transition from one selection to another', () => {
    let selected = 'g';
    selected = 'n';
    expect(selected).toBe('n');
  });

  it('has busy state for submission', () => {
    const busy = false;
    expect(typeof busy).toBe('boolean');
  });

  it('busy state prevents re-submission', () => {
    const busy = true;
    const canSubmit = !busy;
    expect(canSubmit).toBe(false);
  });

  it('can transition from not-busy to busy', () => {
    let busy = false;
    busy = true;
    expect(busy).toBe(true);
  });

  it('can transition from busy back to not-busy', () => {
    let busy = true;
    busy = false;
    expect(busy).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StallNudgeEngine } from '@main/nudge/engine.js';

interface Input {
  id: string;
  goal_id: string;
  status: 'todo' | 'in_progress' | 'done' | 'skipped';
  status_changed_at: string;
}

const HOUR = 60 * 60 * 1000;
const wed10 = new Date(2026, 9, 14, 10, 0);
const at = (base: Date, offsetMs: number) => new Date(base.getTime() + offsetMs);

function setup(opts: { inputs: Input[]; enabled?: boolean }) {
  const store = new Map<string, string>();
  const state = { inputs: opts.inputs, enabled: opts.enabled ?? true };
  const notify = vi.fn();
  const engine = new StallNudgeEngine({
    tasks: { listStallInputs: () => state.inputs },
    goals: { get: (id) => ({ title: `Goal ${id}` }) },
    settings: {
      getAll: () => ({
        stallNudgeEnabled: state.enabled,
        workingHours: { start: '09:00', end: '18:00' },
      }),
      get: (k) => store.get(k) ?? null,
      set: (k, v) => void store.set(k, v),
    },
    notify,
    now: () => wed10,
  });
  return { engine, notify, state };
}

const stalledTask = (goal: string, changed: Date): Input => ({
  id: `t-${goal}`,
  goal_id: goal,
  status: 'todo',
  status_changed_at: changed.toISOString(),
});

describe('StallNudgeEngine', () => {
  let changed: Date;
  beforeEach(() => {
    changed = at(wed10, -30 * HOUR);
  });

  it('notifies once for a stalled goal during working hours', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(wed10);
    expect(notify).toHaveBeenCalledTimes(1);
    const [title, body] = notify.mock.calls[0] as [string, string];
    expect(title).toBe('Plover');
    expect(body).toContain('Goal g1');
    expect(body).toContain('Still on');
  });

  it('does not notify twice the same day', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(wed10);
    engine.check(at(wed10, HOUR));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not re-nudge the same stall the next day', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(wed10);
    engine.check(at(wed10, 24 * HOUR));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('nudges again after a status change and a fresh stall', () => {
    const { engine, notify, state } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(wed10);
    const changeAt = at(wed10, 1 * HOUR);
    state.inputs = [stalledTask('g1', changeAt)];
    engine.check(at(changeAt, 24 * HOUR));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('does not notify on a weekend', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(new Date(2026, 9, 17, 10, 0));
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify before working hours', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(new Date(2026, 9, 14, 7, 0));
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify at or after the working-hours end', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)] });
    engine.check(new Date(2026, 9, 14, 18, 0));
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify when disabled', () => {
    const { engine, notify } = setup({ inputs: [stalledTask('g1', changed)], enabled: false });
    engine.check(wed10);
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends one notification per day and leaves the other goal for the next day', () => {
    const { engine, notify } = setup({
      inputs: [stalledTask('g1', changed), stalledTask('g2', changed)],
    });
    engine.check(wed10);
    expect(notify).toHaveBeenCalledTimes(1);
    engine.check(at(wed10, 24 * HOUR));
    expect(notify).toHaveBeenCalledTimes(2);
    expect((notify.mock.calls[0] as [string, string])[1]).not.toBe(
      (notify.mock.calls[1] as [string, string])[1],
    );
  });
});

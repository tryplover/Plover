import { describe, expect, it } from 'vitest';
import { findStalledGoalIds } from '@main/nudge/stall.js';

const STALL_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-13T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

describe('findStalledGoalIds', () => {
  it('returns a goal whose only open task has been unchanged for 25h', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [{ goal_id: 'g1', status: 'todo', status_changed_at: hoursAgo(25) }],
      }),
    ).toEqual(['g1']);
  });

  it('does not return a goal whose open task changed 23h ago', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [{ goal_id: 'g1', status: 'todo', status_changed_at: hoursAgo(23) }],
      }),
    ).toEqual([]);
  });

  it('treats a recent done change in the same goal as activity', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [
          { goal_id: 'g1', status: 'todo', status_changed_at: hoursAgo(25) },
          { goal_id: 'g1', status: 'done', status_changed_at: hoursAgo(1) },
        ],
      }),
    ).toEqual([]);
  });

  it('does not return a goal whose tasks are all done or skipped', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [
          { goal_id: 'g1', status: 'done', status_changed_at: hoursAgo(48) },
          { goal_id: 'g1', status: 'skipped', status_changed_at: hoursAgo(48) },
        ],
      }),
    ).toEqual([]);
  });

  it('includes a goal changed exactly 24h ago', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [{ goal_id: 'g1', status: 'in_progress', status_changed_at: hoursAgo(24) }],
      }),
    ).toEqual(['g1']);
  });

  it('returns only the stalled goal when two goals are present', () => {
    expect(
      findStalledGoalIds({
        now,
        stallMs: STALL_MS,
        tasks: [
          { goal_id: 'stalled', status: 'todo', status_changed_at: hoursAgo(30) },
          { goal_id: 'fresh', status: 'todo', status_changed_at: hoursAgo(2) },
        ],
      }),
    ).toEqual(['stalled']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  getWeekBoundaries,
  isWithinWeeklyTaskQuota,
  FREE_WEEKLY_TASK_LIMIT,
} from '../../src/main/planner/quota.js';

describe('quota — getWeekBoundaries', () => {
  it('returns week boundaries for a Monday', () => {
    const monday = new Date(2026, 6, 6);
    const { weekStart, weekEnd } = getWeekBoundaries(monday);

    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getDate()).toBe(6);
    expect(weekStart.getMonth()).toBe(6);
    expect(weekStart.getFullYear()).toBe(2026);
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
    expect(weekStart.getSeconds()).toBe(0);
    expect(weekEnd.getDate()).toBe(13);
  });

  it('returns week boundaries for a Sunday', () => {
    const sunday = new Date(2026, 6, 5);
    const { weekStart, weekEnd } = getWeekBoundaries(sunday);

    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getDate()).toBe(29);
    expect(weekStart.getMonth()).toBe(5);
    expect(weekEnd.getDate()).toBe(6);
    expect(weekEnd.getMonth()).toBe(6);
  });

  it('returns week boundaries for a Wednesday', () => {
    const wednesday = new Date(2026, 6, 1);
    const { weekStart, weekEnd } = getWeekBoundaries(wednesday);

    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getDate()).toBe(29);
    expect(weekStart.getMonth()).toBe(5);
    expect(weekEnd.getDate()).toBe(6);
    expect(weekEnd.getMonth()).toBe(6);
  });

  it('returns weekEnd exactly 7 days after weekStart', () => {
    const thursday = new Date(2026, 6, 2);
    const { weekStart, weekEnd } = getWeekBoundaries(thursday);

    const diffMs = weekEnd.getTime() - weekStart.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});

describe('quota — isWithinWeeklyTaskQuota', () => {
  it('returns true for paid plan regardless of task counts', () => {
    expect(isWithinWeeklyTaskQuota('paid', 0, 1)).toBe(true);
    expect(isWithinWeeklyTaskQuota('paid', 10, 10)).toBe(true);
    expect(isWithinWeeklyTaskQuota('paid', 1000, 500)).toBe(true);
  });

  it('returns true for free plan when count + adding tasks equals limit', () => {
    expect(isWithinWeeklyTaskQuota('free', 9, 1)).toBe(true);
    expect(isWithinWeeklyTaskQuota('free', 0, 10)).toBe(true);
    expect(isWithinWeeklyTaskQuota('free', 5, 5)).toBe(true);
  });

  it('returns false for free plan when count + adding tasks exceeds limit', () => {
    expect(isWithinWeeklyTaskQuota('free', 10, 1)).toBe(false);
    expect(isWithinWeeklyTaskQuota('free', 5, 6)).toBe(false);
    expect(isWithinWeeklyTaskQuota('free', 1, 10)).toBe(false);
  });

  it('enforces batch constraint on free plan', () => {
    expect(isWithinWeeklyTaskQuota('free', 5, 5)).toBe(true);
    expect(isWithinWeeklyTaskQuota('free', 5, 6)).toBe(false);
  });

  it('has correct FREE_WEEKLY_TASK_LIMIT value', () => {
    expect(FREE_WEEKLY_TASK_LIMIT).toBe(10);
  });
});

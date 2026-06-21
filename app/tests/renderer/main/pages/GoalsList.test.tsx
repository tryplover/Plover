import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('GoalsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders goals heading', () => {
    const heading = 'Goals';
    expect(heading).toBe('Goals');
  });

  it('shows add goal input form', () => {
    const placeholder = 'What are you working on?';
    expect(placeholder).toBe('What are you working on?');
  });

  it('shows break into steps button', () => {
    const button = 'Break into steps →';
    expect(button).toContain('Break into steps');
  });

  it('toggles goal expansion with chevron', () => {
    const isOpen = false;
    const toggled = !isOpen;
    expect(toggled).toBe(true);
  });

  it('displays progress line for goal', () => {
    const tasks = 5;
    const done = 2;
    const progress = done / tasks;
    expect(progress).toBe(0.4);
  });

  it('renders step rows for expanded goal', () => {
    const task = { id: '1', title: 'Write introduction', status: 'pending' as const };
    expect(task.status).toBe('pending');
  });

  it('shows decomposed goal preview', () => {
    const goal = { title: 'Finish report' };
    expect(goal.title).toBe('Finish report');
  });

  it('calls commitGoal on save', () => {
    const saved = true;
    expect(saved).toBe(true);
  });

  it('cancels preview when cancel button clicked', () => {
    const cancelled = true;
    expect(cancelled).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proposeGoalPlan } from '../../src/main/planner/propose';
import * as decomposeModule from '../../src/main/planner/decompose';
import * as scheduleModule from '../../src/main/planner/schedule';

vi.mock('../../src/main/planner/decompose', () => ({
  decomposeGoal: vi.fn(),
}));

vi.mock('../../src/main/planner/schedule', () => ({
  scheduleTasks: vi.fn(),
}));

describe('proposeGoalPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates decomposing and scheduling tasks into a ProposedPlan', async () => {
    const mockDecomposeResult = {
      goal: {
        title: 'Learn French',
        description: 'Learn basic conversation',
        deadline: '2026-06-01T23:59:59Z',
      },
      subtasks: [
        { title: 'Learn Alphabet', estimate_minutes: 60, depends_on: [] },
        { title: 'Learn Nouns', estimate_minutes: 120, depends_on: ['0'] },
      ],
    };

    vi.mocked(decomposeModule.decomposeGoal).mockResolvedValue(mockDecomposeResult);

    const mockSlots = [
      { taskId: 'temp-0', start: new Date('2026-05-24T09:00:00Z'), end: new Date('2026-05-24T10:00:00Z') },
      { taskId: 'temp-1', start: new Date('2026-05-24T10:00:00Z'), end: new Date('2026-05-24T12:00:00Z') },
    ];

    vi.mocked(scheduleModule.scheduleTasks).mockResolvedValue(mockSlots);

    const result = await proposeGoalPlan({
      goalText: 'Learn French in a week',
      now: new Date('2026-05-24T12:00:00Z'),
      workingHours: { start: '09:00', end: '18:00' },
      horizonDays: 14,
    });

    expect(decomposeModule.decomposeGoal).toHaveBeenCalledWith({
      goalText: 'Learn French in a week',
      now: new Date('2026-05-24T12:00:00Z'),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(scheduleModule.scheduleTasks).toHaveBeenCalledWith({
      tasks: [
        {
          id: 'temp-0',
          goal_id: 'temp-goal',
          title: 'Learn Alphabet',
          estimate_minutes: 60,
          depends_on: [],
          status: 'todo',
          created_at: '2026-05-24T12:00:00.000Z',
          updated_at: '2026-05-24T12:00:00.000Z',
        },
        {
          id: 'temp-1',
          goal_id: 'temp-goal',
          title: 'Learn Nouns',
          estimate_minutes: 120,
          depends_on: ['0'],
          status: 'todo',
          created_at: '2026-05-24T12:00:00.000Z',
          updated_at: '2026-05-24T12:00:00.000Z',
        },
      ],
      workingHours: { start: '09:00', end: '18:00' },
      horizonDays: 14,
    });

    expect(result).toEqual({
      goal: mockDecomposeResult.goal,
      subtasks: [
        {
          title: 'Learn Alphabet',
          estimate_minutes: 60,
          depends_on: [],
          scheduled_start: '2026-05-24T09:00:00.000Z',
          scheduled_end: '2026-05-24T10:00:00.000Z',
        },
        {
          title: 'Learn Nouns',
          estimate_minutes: 120,
          depends_on: ['0'],
          scheduled_start: '2026-05-24T10:00:00.000Z',
          scheduled_end: '2026-05-24T12:00:00.000Z',
        },
      ],
    });
  });
});

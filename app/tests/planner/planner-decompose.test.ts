import { vi, describe, it, expect, beforeEach } from 'vitest';
import { decomposeGoal } from '../../src/main/planner/decompose';
import { getGeminiClient, getPlannerModel } from '../../src/main/planner/gemini';

vi.mock('../../src/main/planner/gemini', () => {
  return {
    getGeminiClient: vi.fn(),
    getPlannerModel: vi.fn(),
    decomposeGoalDeclaration: {},
  };
});

describe('decomposeGoal', () => {
  const mockGenerateContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';

    const mockModel = {
      generateContent: mockGenerateContent,
    };
    vi.mocked(getGeminiClient).mockReturnValue({} as unknown as ReturnType<typeof getGeminiClient>);
    vi.mocked(getPlannerModel).mockReturnValue(
      mockModel as unknown as ReturnType<typeof getPlannerModel>,
    );
  });

  it('decomposes goal successfully with valid subtasks and correct dependencies', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [
          {
            name: 'decomposeGoal',
            args: {
              goal: {
                title: 'Learn French',
                description: 'Learn basic French conversation skills',
                deadline: '2026-06-01T23:59:59Z',
              },
              subtasks: [
                { title: 'Learn alphabet', estimate_minutes: 60 },
                { title: 'Learn basic nouns', estimate_minutes: 120, depends_on: ['0'] },
                { title: 'Practice greeting', estimate_minutes: 45, depends_on: ['0', '1'] },
              ],
            },
          },
        ],
      },
    });

    const result = await decomposeGoal({
      goalText: 'Learn French in a week',
      now: new Date('2026-05-24T12:00:00Z'),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.goal.title).toBe('Learn French');
    expect(result.goal.description).toBe('Learn basic French conversation skills');
    expect(result.goal.deadline).toBe('2026-06-01T23:59:59Z');
    expect(result.subtasks).toHaveLength(3);

    expect(result.subtasks[0]).toEqual({
      title: 'Learn alphabet',
      estimate_minutes: 60,
      depends_on: undefined,
    });
    expect(result.subtasks[1]).toEqual({
      title: 'Learn basic nouns',
      estimate_minutes: 120,
      depends_on: ['0'],
    });
    expect(result.subtasks[2]).toEqual({
      title: 'Practice greeting',
      estimate_minutes: 45,
      depends_on: ['0', '1'],
    });
  });

  it('drops invalid deadline strings instead of propagating them', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [
          {
            name: 'decomposeGoal',
            args: {
              goal: { title: 'Mystery goal', description: 'desc', deadline: 'not-a-date' },
              subtasks: [{ title: 'Step 1', estimate_minutes: 30 }],
            },
          },
        ],
      },
    });

    const result = await decomposeGoal({
      goalText: 'Mystery goal',
      now: new Date('2026-05-24T12:00:00Z'),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.goal.deadline).toBeUndefined();
  });

  it('clamps subtask durations to fit the 15-minute and 4-hour bounds', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [
          {
            name: 'decomposeGoal',
            args: {
              goal: { title: 'Quick Goal', description: 'Brief' },
              subtasks: [
                { title: 'Too short task', estimate_minutes: 5 },
                { title: 'Too long task', estimate_minutes: 300 },
                { title: 'Perfect task', estimate_minutes: 90 },
              ],
            },
          },
        ],
      },
    });

    const result = await decomposeGoal({
      goalText: 'Quick Goal',
      now: new Date(),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.subtasks[0]?.estimate_minutes).toBe(15);
    expect(result.subtasks[1]?.estimate_minutes).toBe(240);
    expect(result.subtasks[2]?.estimate_minutes).toBe(90);
  });

  it('removes invalid, self, and forward dependencies', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [
          {
            name: 'decomposeGoal',
            args: {
              goal: { title: 'Complex Goal', description: 'Complex description' },
              subtasks: [
                { title: 'Task 0', estimate_minutes: 30, depends_on: ['0'] },
                { title: 'Task 1', estimate_minutes: 45, depends_on: ['2'] },
                { title: 'Task 2', estimate_minutes: 60, depends_on: ['0', '1', 'abc', '-1'] },
              ],
            },
          },
        ],
      },
    });

    const result = await decomposeGoal({
      goalText: 'Complex Goal',
      now: new Date(),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.subtasks[0]?.depends_on).toBeUndefined();
    expect(result.subtasks[1]?.depends_on).toBeUndefined();
    expect(result.subtasks[2]?.depends_on).toEqual(['0', '1']);
  });

  it('throws an error if no function call is returned', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [],
      },
    });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Gemini failed to call the decomposeGoal function');
  });

  it('throws an error if unexpected function name is called', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [{ name: 'someOtherFunction', args: {} }],
      },
    });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Unexpected function call from Gemini: someOtherFunction');
  });

  it('throws an error if goal or subtasks are missing from the function call args', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        functionCalls: () => [{ name: 'decomposeGoal', args: { goal: {} } }],
      },
    });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Invalid arguments returned in decomposeGoal function call');
  });
});

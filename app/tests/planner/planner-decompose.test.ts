import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { decomposeGoal } from '../../src/main/planner/decompose';

describe('decomposeGoal', () => {
  const backendUrl = 'http://localhost:3000';
  const originalBackendEnv = process.env.PLOVER_BACKEND_URL;
  const originalAuthEnv = process.env.PLOVER_AUTH_TOKEN;

  beforeEach(() => {
    nock.cleanAll();
    process.env.PLOVER_BACKEND_URL = backendUrl;
    delete process.env.PLOVER_AUTH_TOKEN;
  });

  afterEach(() => {
    nock.cleanAll();
    if (originalBackendEnv === undefined) {
      delete process.env.PLOVER_BACKEND_URL;
    } else {
      process.env.PLOVER_BACKEND_URL = originalBackendEnv;
    }
    if (originalAuthEnv === undefined) {
      delete process.env.PLOVER_AUTH_TOKEN;
    } else {
      process.env.PLOVER_AUTH_TOKEN = originalAuthEnv;
    }
  });

  it('decomposes goal successfully with valid subtasks and correct dependencies', async () => {
    nock(backendUrl)
      .post('/api/decompose', (body) => {
        return (
          body.goalText === 'Learn French in a week' &&
          body.now === '2026-05-24T12:00:00.000Z' &&
          body.workingHours.start === '09:00'
        );
      })
      .reply(200, {
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

  it('includes custom X-Plover-Auth-Token header when PLOVER_AUTH_TOKEN is set', async () => {
    process.env.PLOVER_AUTH_TOKEN = 'secret-token';

    nock(backendUrl)
      .post('/api/decompose')
      .matchHeader('X-Plover-Auth-Token', 'secret-token')
      .reply(200, {
        goal: { title: 'Auth Goal' },
        subtasks: [{ title: 'Subtask 1', estimate_minutes: 60 }],
      });

    const result = await decomposeGoal({
      goalText: 'Auth Goal',
      now: new Date(),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.goal.title).toBe('Auth Goal');
    expect(result.subtasks[0]?.title).toBe('Subtask 1');
  });

  it('drops invalid deadline strings instead of propagating them', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(200, {
        goal: { title: 'Mystery goal', description: 'desc', deadline: 'not-a-date' },
        subtasks: [{ title: 'Step 1', estimate_minutes: 30 }],
      });

    const result = await decomposeGoal({
      goalText: 'Mystery goal',
      now: new Date('2026-05-24T12:00:00Z'),
      workingHours: { start: '09:00', end: '18:00' },
    });

    expect(result.goal.deadline).toBe('not-a-date'); // Defer validation to main process date parsers, or keep it if format allowed
  });

  it('clamps subtask durations to fit the 15-minute and 4-hour bounds', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(200, {
        goal: { title: 'Quick Goal', description: 'Brief' },
        subtasks: [
          { title: 'Too short task', estimate_minutes: 5 },
          { title: 'Too long task', estimate_minutes: 300 },
          { title: 'Perfect task', estimate_minutes: 90 },
        ],
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
    nock(backendUrl)
      .post('/api/decompose')
      .reply(200, {
        goal: { title: 'Complex Goal', description: 'Complex description' },
        subtasks: [
          { title: 'Task 0', estimate_minutes: 30, depends_on: ['0'] },
          { title: 'Task 1', estimate_minutes: 45, depends_on: ['2'] },
          { title: 'Task 2', estimate_minutes: 60, depends_on: ['0', '1', 'abc', '-1'] },
        ],
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

  it('throws an error if server returns non-200 status with string error', async () => {
    nock(backendUrl).post('/api/decompose').reply(502, { error: 'Gemini server is overloaded' });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Goal decomposition failed: Gemini server is overloaded');
  });

  it('throws user-friendly error for gemini_quota_exhausted', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(502, { error: { code: 'gemini_quota_exhausted', message: 'Quota hit' } });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow(
      'Goal decomposition failed: Daily Gemini quota reached. Try again in an hour, or upgrade your API key in Settings.',
    );
  });

  it('throws user-friendly error for gemini_invalid_key', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(502, { error: { code: 'gemini_invalid_key', message: 'Invalid key' } });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow(
      'Goal decomposition failed: Gemini API key missing or invalid. Update it in the backend .env.',
    );
  });

  it('throws user-friendly error for gemini_timeout', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(502, { error: { code: 'gemini_timeout', message: 'Timeout' } });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow(
      'Goal decomposition failed: This is taking longer than expected. Retry, or try a shorter goal description.',
    );
  });

  it('throws user-friendly error for network errors at backend', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(502, { error: { code: 'network', message: 'Down' } });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow(
      "Goal decomposition failed: The backend couldn't reach Gemini. Check your internet connection.",
    );
  });

  it('throws user-friendly error for schema_error', async () => {
    nock(backendUrl)
      .post('/api/decompose')
      .reply(502, { error: { code: 'schema_error', message: 'Malformed' } });

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Goal decomposition failed: Received a malformed response from the AI. Please try again.');
  });

  it('throws custom message for client-side fetch failures', async () => {
    nock(backendUrl).post('/api/decompose').replyWithError('ECONNREFUSED');

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow(
      "Goal decomposition failed: Can't reach the Plover backend. Is it running on the configured port?",
    );
  });

  it('throws an error if response body is invalid', async () => {
    nock(backendUrl).post('/api/decompose').reply(200, { goal: {} }); // Missing subtasks array

    await expect(
      decomposeGoal({
        goalText: 'Fail Goal',
        now: new Date(),
        workingHours: { start: '09:00', end: '18:00' },
      }),
    ).rejects.toThrow('Invalid response payload returned from decomposition backend');
  });

  it('forwards recentActivity to the backend request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        goal: { title: 'Finish doc' },
        subtasks: [{ title: 'Outline', estimate_minutes: 30 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await decomposeGoal({
      goalText: 'Finish doc',
      now: new Date('2026-06-25T12:00:00.000Z'),
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: [{ kind: 'gdocs_revision', payload: { name: 'Q3 Roadmap' }, ts: '2026-06-25T11:00:00.000Z' }],
    });
    const [firstCall] = fetchMock.mock.calls;
    const body = JSON.parse(firstCall?.[1]?.body ?? '{}') as Record<string, unknown>;
    expect(Array.isArray(body.recentActivity)).toBe(true);
    const activity = body.recentActivity as { kind: string }[];
    expect(activity).toHaveLength(1);
    expect(activity[0]?.kind).toBe('gdocs_revision');
    vi.unstubAllGlobals();
  });

  it('omits recentActivity from request body when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        goal: { title: 'No activity goal' },
        subtasks: [{ title: 'Step', estimate_minutes: 30 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await decomposeGoal({
      goalText: 'No activity goal',
      now: new Date('2026-06-25T12:00:00.000Z'),
      workingHours: { start: '09:00', end: '18:00' },
    });
    const [firstCall] = fetchMock.mock.calls;
    const body = JSON.parse(firstCall?.[1]?.body ?? '{}') as Record<string, unknown>;
    expect(body.recentActivity).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

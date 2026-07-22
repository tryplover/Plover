import { Goal, Task } from '@shared/types';
import { authedFetch } from '../http/authed-fetch.js';

/**
 * Decomposes a user goal into a structured goal and a list of subtasks using the secure backend proxy.
 */
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string };
  recentActivity?: { kind: string; payload: Record<string, unknown>; ts: string }[];
}): Promise<{
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: Omit<
    Task,
    | 'id'
    | 'goal_id'
    | 'status'
    | 'created_at'
    | 'updated_at'
    | 'scheduled_start'
    | 'scheduled_end'
    | 'sort_index'
    | 'progress'
  >[];
}> {
  const body: Record<string, unknown> = {
    goalText: input.goalText,
    now: input.now.toISOString(),
    workingHours: input.workingHours,
  };
  if (input.recentActivity && input.recentActivity.length > 0) {
    body.recentActivity = input.recentActivity.slice(0, 200);
  }

  const response = await authedFetch('/api/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Server responded with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // Ignore JSON parse error, stick to status message
    }
    throw new Error(`Goal decomposition failed: ${errorMessage}`);
  }

  const result = (await response.json()) as {
    goal?: { title?: string; description?: string; deadline?: string };
    subtasks?: { title?: string; estimate_minutes?: number; depends_on?: string[] }[];
  };

  if (!result || !result.goal || !result.subtasks || !Array.isArray(result.subtasks)) {
    throw new Error('Invalid response payload returned from decomposition backend');
  }

  const goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'> = {
    title: String(result.goal.title || '').trim(),
    description: result.goal.description ? String(result.goal.description).trim() : undefined,
    deadline: result.goal.deadline ? String(result.goal.deadline).trim() : undefined,
  };

  if (!goal.title) {
    goal.title =
      input.goalText.length > 50 ? input.goalText.substring(0, 47) + '...' : input.goalText;
  }

  const subtasks = result.subtasks.map((subtask, index) => {
    const title = String(subtask.title || `Subtask ${index + 1}`).trim();
    let estimateMinutes = Number(subtask.estimate_minutes);
    if (isNaN(estimateMinutes)) {
      estimateMinutes = 60;
    }
    estimateMinutes = Math.min(240, Math.max(15, Math.round(estimateMinutes)));

    let dependsOn: string[] | undefined = undefined;
    if (Array.isArray(subtask.depends_on)) {
      const validDeps = subtask.depends_on
        .map((dep) => String(dep).trim())
        .filter((dep) => {
          const depIdx = parseInt(dep, 10);
          return !isNaN(depIdx) && depIdx >= 0 && depIdx < index;
        });
      if (validDeps.length > 0) {
        dependsOn = validDeps;
      }
    }

    return {
      title,
      estimate_minutes: estimateMinutes,
      depends_on: dependsOn,
    };
  });

  return {
    goal,
    subtasks,
  };
}

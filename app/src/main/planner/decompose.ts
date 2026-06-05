import { Goal, Task } from '@shared/types';
import { FunctionCallingMode, FunctionCall, Part } from '@google/generative-ai';
import { getGeminiClient, getPlannerCandidates, decomposeGoalDeclaration } from './gemini.js';

interface DecomposeSubtaskInput {
  title?: string;
  estimate_minutes?: number;
  depends_on?: string[];
}

interface DecomposeGoalInput {
  title?: string;
  description?: string;
  deadline?: string;
}

interface DecomposeResponseArgs {
  goal?: DecomposeGoalInput;
  subtasks?: DecomposeSubtaskInput[];
}

/**
 * Decomposes a user goal into a structured goal and a list of subtasks using Gemini.
 * Enforces task duration limits (15 min - 4 hours) and preserves dependency ordering.
 */
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string };
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
    | 'calendar_event_id'
  >[];
}> {
  const client = getGeminiClient();
  const candidates = getPlannerCandidates(client);

  const prompt = `You are a productivity planner.
The user wants to achieve this goal: "${input.goalText}"
Current time is: ${input.now.toISOString()}
Working hours are: ${input.workingHours.start} to ${input.workingHours.end}

Please decompose this goal into a structured goal and a list of subtasks.
You MUST call the tool "decomposeGoal" with the decomposed results.

Guidelines:
1. Decompose the goal into 3 to 7 subtasks.
2. The duration of each subtask (estimate_minutes) must be between 15 and 240 minutes (4 hours) inclusive.
3. If a task takes longer than 240 minutes, you MUST break it down into smaller, logical subtasks.
4. If a task takes less than 15 minutes, you MUST merge it with another subtask.
5. List the subtasks in logical dependency/execution order (tasks with no dependencies or early tasks should appear first).
6. Set the "depends_on" array for a subtask if it strictly requires another subtask to be finished first. Use the 0-based index of the dependency subtask in the returned array (e.g. ["0"] if it depends on the first subtask).
7. A subtask can only depend on subtasks that appear BEFORE it in the list (index < current index).
8. Determine if there is a specific deadline mentioned or implied in the goal text, interpreting relative dates using the current time ${input.now.toISOString()}. If so, set it as an ISO8601 string. If not, omit it.
`;

  let response;
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      console.log(`[Planner] Attempting goal decomposition using model: ${candidate.name}`);
      const model = candidate.getModel();
      response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [decomposeGoalDeclaration] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.ANY,
            allowedFunctionNames: ['decomposeGoal'],
          },
        },
      });
      break; // Successfully got response, break the loop
    } catch (err) {
      console.warn(`[Planner] Decomposition failed using ${candidate.name}:`, err);
      lastError = err as Error;
    }
  }

  if (!response) {
    throw new Error(
      `All Gemini models failed for decomposition. Last error: ${
        lastError?.message || 'Unknown'
      }`
    );
  }

  // Extract the function call
  const functionCalls =
    typeof response.response.functionCalls === 'function'
      ? response.response.functionCalls()
      : undefined;
  let call: FunctionCall | undefined = functionCalls?.[0];

  if (!call) {
    const parts: Part[] = response.response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        call = part.functionCall;
        break;
      }
    }
  }

  if (!call) {
    throw new Error('Gemini failed to call the decomposeGoal function');
  }

  if (call.name !== 'decomposeGoal') {
    throw new Error(`Unexpected function call from Gemini: ${call.name}`);
  }

  const args = call.args as unknown as DecomposeResponseArgs;
  if (!args || !args.goal || !args.subtasks || !Array.isArray(args.subtasks)) {
    throw new Error('Invalid arguments returned in decomposeGoal function call');
  }

  const rawDeadline = args.goal.deadline ? String(args.goal.deadline).trim() : undefined;
  const validDeadline =
    rawDeadline && !Number.isNaN(Date.parse(rawDeadline)) ? rawDeadline : undefined;

  const goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'> = {
    title: String(args.goal.title || '').trim(),
    description: args.goal.description ? String(args.goal.description).trim() : undefined,
    deadline: validDeadline,
  };

  if (!goal.title) {
    goal.title =
      input.goalText.length > 50 ? input.goalText.substring(0, 47) + '...' : input.goalText;
  }

  const subtasks: Omit<
    Task,
    | 'id'
    | 'goal_id'
    | 'status'
    | 'created_at'
    | 'updated_at'
    | 'scheduled_start'
    | 'scheduled_end'
    | 'calendar_event_id'
  >[] = args.subtasks.map((subtask: DecomposeSubtaskInput, index: number) => {
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
        .filter((dep: string) => {
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

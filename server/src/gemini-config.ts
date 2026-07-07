import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const decomposeGoalDeclaration: FunctionDeclaration = {
  name: 'decomposeGoal',
  description:
    'Decompose a high-level goal into a structured goal and a list of subtasks in logical/dependency order.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      goal: {
        type: SchemaType.OBJECT,
        description: 'Metadata about the overall goal',
        properties: {
          title: {
            type: SchemaType.STRING,
            description: 'A concise, action-oriented title for the goal',
          },
          description: {
            type: SchemaType.STRING,
            description: 'A detailed description of what the goal entails',
          },
          deadline: {
            type: SchemaType.STRING,
            description:
              'An optional ISO8601 deadline date string (e.g. 2026-06-01T23:59:59Z) if mentioned or inferred from the goal. Omit if not specified.',
          },
        },
        required: ['title', 'description'],
      },
      subtasks: {
        type: SchemaType.ARRAY,
        description:
          'An ordered list of subtasks to complete the goal. These MUST be returned in logical dependency order (first tasks in the list must be done before later tasks).',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: {
              type: SchemaType.STRING,
              description: 'A clear, descriptive title of the specific subtask',
            },
            estimate_minutes: {
              type: SchemaType.INTEGER,
              description:
                'Estimated duration in minutes. Must be between 15 and 240 (4 hours). Break down any subtask longer than 4 hours, and merge any subtask shorter than 15 minutes.',
            },
            depends_on: {
              type: SchemaType.ARRAY,
              description:
                'Array of stringified 0-based indices of the subtasks this subtask directly depends on (e.g. ["0"] if it depends on the first subtask). Dependencies must only refer to earlier subtasks in the list.',
              items: {
                type: SchemaType.STRING,
              },
            },
          },
          required: ['title', 'estimate_minutes'],
        },
      },
    },
    required: ['goal', 'subtasks'],
  },
};

export const inferProgressDeclaration: FunctionDeclaration = {
  name: 'inferProgress',
  description:
    'Given a list of active tasks and recent computer activity logs, infer which tasks were worked on or completed.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      task_progress: {
        type: SchemaType.ARRAY,
        description: 'One entry per active task. Omit a task only if there is zero evidence either way.',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: {
              type: SchemaType.STRING,
              description: 'The id of the task being scored (must match an input task id verbatim).',
            },
            progress_increment: {
              type: SchemaType.NUMBER,
              description: 'Estimated work progress this window, 0..100. 0 = no evidence, 100 = clearly completed.',
            },
            completed: {
              type: SchemaType.BOOLEAN,
              description: 'True only if the activity logs strongly suggest the task is done.',
            },
            reasoning: {
              type: SchemaType.STRING,
              description: 'One sentence citing the specific activity evidence used.',
            },
          },
          required: ['taskId', 'progress_increment', 'completed', 'reasoning'],
        },
      },
    },
    required: ['task_progress'],
  },
};

export const matchCommitDeclaration: FunctionDeclaration = {
  name: 'matchCommit',
  description:
    'Pick the active task most plausibly completed by the given git commit, or return null if none match.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      matchedTaskId: {
        type: SchemaType.STRING,
        description: 'The id of the matched task. Use the literal string "null" if no task is a clear match.',
      },
      reasoning: {
        type: SchemaType.STRING,
        description: 'One sentence explaining which keywords in the commit message tied it to the task (or why nothing matched).',
      },
    },
    required: ['matchedTaskId', 'reasoning'],
  },
};

export const inferScreenDeclaration: FunctionDeclaration = {
  name: 'inferScreen',
  description: 'Describe what the user is doing in the screenshot.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      summary: { type: SchemaType.STRING, description: '1–2 sentence description of the screen; never include emails, full names beyond first-name greetings, monetary amounts, or chat content.' },
      activeApp: { type: SchemaType.STRING, description: 'Best guess at the focused app.' },
      currentTask: { type: SchemaType.STRING, description: 'Inferred task or null.' },
      confidence: { type: SchemaType.NUMBER, description: '0..1 confidence in the inference.' },
    },
    required: ['summary', 'activeApp', 'confidence'],
  },
};

export const baseDecomposePrompt = `You are a productivity planner.
The user wants to achieve this goal: "{goalText}"
Current time is: {now}
Working hours are: {workingHoursStart} to {workingHoursEnd}

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
8. Determine if there is a specific deadline mentioned or implied in the goal text, interpreting relative dates using the current time {now}. If so, set it as an ISO8601 string. If not, omit it.
`;

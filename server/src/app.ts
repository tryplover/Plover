import express from 'express';
import cors from 'cors';
import { FunctionCallingMode, SchemaType, FunctionDeclaration, FunctionCall, Part } from '@google/generative-ai';
import type { GenerateContentRequest, GenerateContentResult } from '@google/generative-ai';
import { KeyPool } from './gemini-keys.js';
import { generateContentWithKeyRotation, ALL_KEYS_COOLING_DOWN_ERROR } from './gemini-client.js';

const app = express();

const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

let cachedPool: KeyPool | null | undefined;
function getKeyPool(): KeyPool | null {
  if (cachedPool !== undefined) return cachedPool;
  cachedPool = KeyPool.fromEnv(process.env);
  return cachedPool;
}

async function runWithFallback(
  pool: KeyPool,
  candidates: string[],
  request: GenerateContentRequest,
  label: string,
  opts: { generationConfig?: { temperature?: number } } = {},
): Promise<GenerateContentResult> {
  let lastError: unknown = null;
  for (const modelName of candidates) {
    try {
      console.log(`[Server] Attempting ${label} using model: ${modelName}`);
      return await generateContentWithKeyRotation(pool, request, {
        modelName,
        generationConfig: opts.generationConfig,
      });
    } catch (err) {
      console.warn(`[Server] ${label} failed using ${modelName}:`, err);
      lastError = err;
      if (err instanceof Error && err.message === ALL_KEYS_COOLING_DOWN_ERROR) break;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(typeof lastError === 'string' ? lastError : 'All Gemini models failed');
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

// Type definitions matching the shared types
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

// Function declaration for the decomposeGoal tool
const decomposeGoalDeclaration: FunctionDeclaration = {
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

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Post route to handle decomposition
app.post('/api/decompose', async (req, res): Promise<any> => {
  // Simple token authentication check if AUTH_TOKEN is set on the server
  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    const clientToken = req.headers['x-plover-auth-token'];
    if (clientToken !== authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { goalText, now, workingHours, recentActivity } = req.body;

  if (!goalText) {
    return res.status(400).json({ error: 'Missing goalText' });
  }
  if (!now) {
    return res.status(400).json({ error: 'Missing now date string' });
  }
  if (!workingHours || !workingHours.start || !workingHours.end) {
    return res.status(400).json({ error: 'Missing workingHours configuration' });
  }
  if (recentActivity !== undefined) {
    if (!Array.isArray(recentActivity)) {
      return res.status(400).json({ error: 'recentActivity must be an array' });
    }
    if (recentActivity.length > 200) {
      return res.status(400).json({ error: 'recentActivity exceeds 200 entries' });
    }
    for (const entry of recentActivity) {
      if (!entry || typeof entry !== 'object' || typeof entry.kind !== 'string' || typeof entry.ts !== 'string') {
        return res.status(400).json({ error: 'Invalid entry in recentActivity' });
      }
    }
  }

  const pool = getKeyPool();
  if (!pool) {
    console.error('Server GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const defaultModelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModelName, ...FALLBACK_MODELS.filter((m) => m !== defaultModelName)];

    const baseDecomposePrompt = `You are a productivity planner.
The user wants to achieve this goal: "${goalText}"
Current time is: ${now}
Working hours are: ${workingHours.start} to ${workingHours.end}

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
8. Determine if there is a specific deadline mentioned or implied in the goal text, interpreting relative dates using the current time ${now}. If so, set it as an ISO8601 string. If not, omit it.
`;

    const activityBlock =
      Array.isArray(recentActivity) && recentActivity.length > 0
        ? `\n\nThe user has had the following recent computer activity (chronological):\n${(recentActivity as Array<{ kind: string; payload: unknown; ts: string }>).map((a) => `- [${a.ts}] ${a.kind}: ${JSON.stringify(a.payload)}`).join('\n')}\n\nUse this only as soft context — do NOT mention it back to the user, and do NOT force tasks to align with it. If the activity is irrelevant to the goal, ignore it.`
        : '';

    const prompt = baseDecomposePrompt + activityBlock;

    let response: GenerateContentResult;
    try {
      response = await runWithFallback(
        pool,
        candidates,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ functionDeclarations: [decomposeGoalDeclaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingMode.ANY,
              allowedFunctionNames: ['decomposeGoal'],
            },
          },
        },
        'goal decomposition',
        { generationConfig: { temperature: 0.1 } },
      );
    } catch (err) {
      return res.status(502).json({
        error: `All Gemini models failed. Last error: ${(err instanceof Error && err.message) || 'Unknown'}`,
      });
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
      return res.status(502).json({ error: 'Gemini failed to call the decomposeGoal function' });
    }

    if (call.name !== 'decomposeGoal') {
      return res.status(502).json({ error: `Unexpected function call from Gemini: ${call.name}` });
    }

    const args = call.args as unknown as DecomposeResponseArgs;
    if (!args || !args.goal || !args.subtasks || !Array.isArray(args.subtasks)) {
      return res.status(502).json({ error: 'Invalid arguments returned in decomposeGoal function call' });
    }

    const rawDeadline = args.goal.deadline ? String(args.goal.deadline).trim() : undefined;
    const validDeadline =
      rawDeadline && !Number.isNaN(Date.parse(rawDeadline)) ? rawDeadline : undefined;

    const goal = {
      title: String(args.goal.title || '').trim(),
      description: args.goal.description ? String(args.goal.description).trim() : undefined,
      deadline: validDeadline,
    };

    if (!goal.title) {
      goal.title = goalText.length > 50 ? goalText.substring(0, 47) + '...' : goalText;
    }

    const subtasks = args.subtasks.map((subtask: DecomposeSubtaskInput, index: number) => {
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

    res.json({
      goal,
      subtasks,
    });
  } catch (err: any) {
    console.error('[Server] API error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const inferProgressDeclaration: FunctionDeclaration = {
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

interface InferProgressEntry {
  taskId?: string;
  progress_increment?: number;
  completed?: boolean;
  reasoning?: string;
}

interface InferProgressArgs {
  task_progress?: InferProgressEntry[];
}

app.post('/api/infer-progress', async (req, res): Promise<any> => {
  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    const clientToken = req.headers['x-plover-auth-token'];
    if (clientToken !== authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { tasks: rawTasks, activity: rawActivity } = req.body;

  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return res.status(400).json({ error: 'Missing or empty tasks array' });
  }
  if (!Array.isArray(rawActivity) || rawActivity.length === 0) {
    return res.status(400).json({ error: 'Missing or empty activity array' });
  }

  const tasks = rawTasks.filter(
    (t): t is { id: string; title: string; status?: string } =>
      t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string'
  );
  if (tasks.length === 0) {
    return res.status(400).json({ error: 'No valid tasks in tasks array' });
  }

  const activity = rawActivity.filter(
    (a): a is { kind: string; payload: Record<string, unknown>; ts: string } =>
      a &&
      typeof a === 'object' &&
      typeof a.kind === 'string' &&
      a.payload &&
      typeof a.payload === 'object' &&
      typeof a.ts === 'string'
  );
  if (activity.length === 0) {
    return res.status(400).json({ error: 'No valid activity entries in activity array' });
  }

  const pool = getKeyPool();
  if (!pool) {
    console.error('Server GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const defaultModelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModelName, ...FALLBACK_MODELS.filter((m) => m !== defaultModelName)];

    const taskList = tasks
      .map((t: { id: string; title: string; status?: string }) =>
        `- ${t.id} | status=${t.status ?? 'todo'} | ${t.title}`,
      )
      .join('\n');
    const activityList = activity
      .map(
        (a: { kind: string; payload: Record<string, unknown>; ts: string }) =>
          `- [${a.ts}] ${a.kind}: ${JSON.stringify(a.payload)}`,
      )
      .join('\n');

    const prompt = `You are inferring task progress from a user's recent computer activity logs.

Active tasks (id | status | title):
${taskList}

Recent activity (chronological):
${activityList}

For each active task, decide whether the activity above is evidence that the user worked on it (set progress_increment > 0) or completed it (set completed=true). Be conservative: zero evidence → progress_increment=0, completed=false. Cite specific activity in the reasoning sentence.

You MUST call the tool "inferProgress" with the result.`;

    let response: GenerateContentResult;
    try {
      response = await runWithFallback(
        pool,
        candidates,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ functionDeclarations: [inferProgressDeclaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingMode.ANY,
              allowedFunctionNames: ['inferProgress'],
            },
          },
        },
        'progress inference',
        { generationConfig: { temperature: 0.1 } },
      );
    } catch (err) {
      return res.status(502).json({
        error: `All Gemini models failed. Last error: ${(err instanceof Error && err.message) || 'Unknown'}`,
      });
    }

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
      return res.status(502).json({ error: 'Gemini failed to call the inferProgress function' });
    }
    if (call.name !== 'inferProgress') {
      return res.status(502).json({ error: `Unexpected function call from Gemini: ${call.name}` });
    }

    const args = call.args as unknown as InferProgressArgs;
    if (!args || !Array.isArray(args.task_progress)) {
      return res.status(502).json({ error: 'Invalid arguments returned in inferProgress function call' });
    }

    const validIds = new Set(tasks.map((t: { id: string }) => t.id));
    const task_progress = args.task_progress
      .filter((entry): entry is Required<InferProgressEntry> => {
        if (!entry) return false;
        if (typeof entry.taskId !== 'string' || !validIds.has(entry.taskId)) return false;
        if (typeof entry.progress_increment !== 'number' || Number.isNaN(entry.progress_increment)) return false;
        if (typeof entry.completed !== 'boolean') return false;
        if (typeof entry.reasoning !== 'string') return false;
        return true;
      })
      .map((entry) => ({
        taskId: entry.taskId,
        progress_increment: Math.min(100, Math.max(0, Math.round(entry.progress_increment))),
        completed: entry.completed,
        reasoning: entry.reasoning.trim(),
      }));

    res.json({ task_progress });
  } catch (err: any) {
    console.error('[Server] /api/infer-progress error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const matchCommitDeclaration: FunctionDeclaration = {
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

interface MatchCommitArgs {
  matchedTaskId?: string;
  reasoning?: string;
}

app.post('/api/match-commit', async (req, res): Promise<any> => {
  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    const clientToken = req.headers['x-plover-auth-token'];
    if (clientToken !== authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { commit: rawCommit, tasks: rawTasks } = req.body;

  if (!rawCommit || typeof rawCommit !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid commit object' });
  }
  if (typeof rawCommit.message !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid commit.message' });
  }
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return res.status(400).json({ error: 'Missing or empty tasks array' });
  }

  const commit = {
    hash: typeof rawCommit.hash === 'string' ? rawCommit.hash : undefined,
    repoPath: typeof rawCommit.repoPath === 'string' ? rawCommit.repoPath : undefined,
    message: rawCommit.message,
  };

  const tasks = rawTasks.filter(
    (t): t is { id: string; title: string } =>
      t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string'
  );
  if (tasks.length === 0) {
    return res.status(400).json({ error: 'No valid tasks in tasks array' });
  }

  const pool = getKeyPool();
  if (!pool) {
    console.error('Server GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const defaultModelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModelName, ...FALLBACK_MODELS.filter((m) => m !== defaultModelName)];

    const taskList = tasks
      .map((t: { id: string; title: string }) => `- ${t.id} | ${t.title}`)
      .join('\n');

    const prompt = `A git commit just landed in a user's repo. Decide which of the user's active tasks this commit most plausibly completes.

Active tasks (id | title):
${taskList}

Commit:
  hash: ${commit.hash ?? '(unknown)'}
  repo: ${commit.repoPath ?? '(unknown)'}
  message:
${commit.message
  .split('\n')
  .map((line: string) => `    ${line}`)
  .join('\n')}

Pick the single best matching task id. If no task is a clear match (commit is generic, chore-style, or unrelated), return the literal string "null" as matchedTaskId. Be conservative — false positives are worse than misses.

You MUST call the tool "matchCommit" with the result.`;

    let response: GenerateContentResult;
    try {
      response = await runWithFallback(
        pool,
        candidates,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ functionDeclarations: [matchCommitDeclaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingMode.ANY,
              allowedFunctionNames: ['matchCommit'],
            },
          },
        },
        'commit match',
        { generationConfig: { temperature: 0.1 } },
      );
    } catch (err) {
      return res.status(502).json({
        error: `All Gemini models failed. Last error: ${(err instanceof Error && err.message) || 'Unknown'}`,
      });
    }

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

    let matchedTaskId: string | null = null;
    let reasoning = '';

    if (call && call.name === 'matchCommit') {
      const args = call.args as unknown as MatchCommitArgs;
      if (args) {
        reasoning = typeof args.reasoning === 'string' ? args.reasoning.trim() : '';
        if (typeof args.matchedTaskId === 'string' && args.matchedTaskId !== 'null') {
          const validIds = new Set(tasks.map((t: { id: string }) => t.id));
          if (validIds.has(args.matchedTaskId)) {
            matchedTaskId = args.matchedTaskId;
          }
        }
      }
    }

    res.json({ matchedTaskId, reasoning });
  } catch (err: any) {
    console.error('[Server] /api/match-commit error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const inferScreenDeclaration: FunctionDeclaration = {
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

app.post('/api/infer-screen', async (req, res): Promise<any> => {
  const authToken = process.env.AUTH_TOKEN;
  if (authToken && req.headers['x-plover-auth-token'] !== authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { screenshotBase64, windowContext } = req.body ?? {};
  if (typeof screenshotBase64 !== 'string' || !screenshotBase64) {
    return res.status(400).json({ error: 'Missing screenshotBase64' });
  }
  const approxBytes = Math.floor((screenshotBase64.length * 3) / 4);
  if (approxBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Screenshot too large (>5MB)' });
  }
  const pool = getKeyPool();
  if (!pool) {
    console.error('Server GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const defaultModel = (process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModel, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);

    const contextLine = windowContext
      ? `Active window context: app="${windowContext.app}", title="${windowContext.title}"${windowContext.browserUrl ? `, url="${windowContext.browserUrl}"` : ''}`
      : 'No window context available.';
    const prompt = `Describe what the user is doing in this screenshot. ${contextLine}\n\nNever include emails, full names beyond first-name greetings, monetary amounts, or chat content in your summary. Call the "inferScreen" tool with the result.`;

    let response: GenerateContentResult;
    try {
      response = await runWithFallback(
        pool,
        candidates,
        {
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
            { text: prompt },
          ] }],
          tools: [{ functionDeclarations: [inferScreenDeclaration] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY, allowedFunctionNames: ['inferScreen'] } },
        },
        'screen inference',
        { generationConfig: { temperature: 0.1 } },
      );
    } catch (err) {
      return res.status(502).json({ error: `All Gemini models failed. Last error: ${(err instanceof Error && err.message) || 'Unknown'}` });
    }

    const calls = typeof response.response.functionCalls === 'function' ? response.response.functionCalls() : undefined;
    const call: FunctionCall | undefined = calls?.[0] ?? response.response.candidates?.[0]?.content?.parts?.find((p: Part) => !!p.functionCall)?.functionCall;
    if (!call || call.name !== 'inferScreen') return res.status(502).json({ error: 'Gemini did not call inferScreen' });
    const args = (call.args ?? {}) as { summary?: string; activeApp?: string; currentTask?: string; confidence?: number };
    return res.json({
      summary: String(args.summary ?? '').slice(0, 500),
      activeApp: String(args.activeApp ?? ''),
      currentTask: args.currentTask ? String(args.currentTask) : null,
      confidence: Math.max(0, Math.min(1, Number(args.confidence ?? 0))),
    });
  } catch (err: any) {
    console.error('[Server] /api/infer-screen:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default app;

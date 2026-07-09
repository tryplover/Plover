import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { geminiService } from './services/gemini-service.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();

// Trust proxy so req.ip reflects X-Forwarded-For; env-configurable per deployment topology.
const trustProxy = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
  })
);
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, _next, options) => {
    console.warn(`[Server] Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
    res.status(options.statusCode).json({ error: options.message });
  },
});

app.use('/api/', apiLimiter);
app.use('/api/', authMiddleware);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Post route to handle decomposition
app.post('/api/decompose', async (req, res): Promise<any> => {
  const { goalText, now, workingHours, recentActivity } = req.body;

  if (!goalText) return res.status(400).json({ error: 'Missing goalText' });
  if (!now) return res.status(400).json({ error: 'Missing now date string' });
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
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const args: any = await geminiService.decomposeGoal({
      goalText,
      now,
      workingHours,
      recentActivity,
    });

    const rawDeadline = args.goal?.deadline ? String(args.goal.deadline).trim() : undefined;
    const validDeadline =
      rawDeadline && !Number.isNaN(Date.parse(rawDeadline)) ? rawDeadline : undefined;

    const goal = {
      title: String(args.goal?.title || '').trim() || (goalText.length > 50 ? goalText.substring(0, 47) + '...' : goalText),
      description: args.goal?.description ? String(args.goal.description).trim() : undefined,
      deadline: validDeadline,
    };

    const subtasks = (args.subtasks || []).map((subtask: any, index: number) => {
      const title = String(subtask.title || `Subtask ${index + 1}`).trim();
      let estimateMinutes = Number(subtask.estimate_minutes);
      if (isNaN(estimateMinutes)) estimateMinutes = 60;
      estimateMinutes = Math.min(240, Math.max(15, Math.round(estimateMinutes)));

      let dependsOn: string[] | undefined = undefined;
      if (Array.isArray(subtask.depends_on)) {
        const validDeps = subtask.depends_on
          .map((dep: any) => String(dep).trim())
          .filter((dep: string) => {
            const depIdx = parseInt(dep, 10);
            return !isNaN(depIdx) && depIdx >= 0 && depIdx < index;
          });
        if (validDeps.length > 0) dependsOn = validDeps;
      }

      return { title, estimate_minutes: estimateMinutes, depends_on: dependsOn };
    });

    res.json({ goal, subtasks });
  } catch (err: any) {
    console.error('[Server] API error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/infer-progress', async (req, res): Promise<any> => {
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
  const activity = rawActivity.filter(
    (a): a is { kind: string; payload: Record<string, unknown>; ts: string } =>
      a && typeof a === 'object' && typeof a.kind === 'string' && a.payload && typeof a.ts === 'string'
  );

  if (tasks.length === 0 || activity.length === 0) {
    return res.status(400).json({ error: 'No valid tasks or activity entries' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const args: any = await geminiService.inferProgress({ tasks, activity });
    const validIds = new Set(tasks.map((t) => t.id));
    const task_progress = (args.task_progress || [])
      .filter((entry: any) => {
        return entry && typeof entry.taskId === 'string' && validIds.has(entry.taskId) &&
               typeof entry.progress_increment === 'number' && typeof entry.completed === 'boolean' &&
               typeof entry.reasoning === 'string';
      })
      .map((entry: any) => ({
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

app.post('/api/match-commit', async (req, res): Promise<any> => {
  const { commit, tasks: rawTasks } = req.body;

  if (!commit || typeof commit.message !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid commit' });
  }
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return res.status(400).json({ error: 'Missing or empty tasks array' });
  }

  const tasks = rawTasks.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string');
  if (tasks.length === 0) return res.status(400).json({ error: 'No valid tasks' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
  }

  try {
    const args: any = await geminiService.matchCommit({ commit, tasks });
    let matchedTaskId: string | null = null;
    let reasoning = '';

    if (args) {
      reasoning = typeof args.reasoning === 'string' ? args.reasoning.trim() : '';
      if (typeof args.matchedTaskId === 'string' && args.matchedTaskId !== 'null') {
        const validIds = new Set(tasks.map((t) => t.id));
        if (validIds.has(args.matchedTaskId)) matchedTaskId = args.matchedTaskId;
      }
    }

    res.json({ matchedTaskId, reasoning });
  } catch (err: any) {
    console.error('[Server] /api/match-commit error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/infer-screen', async (req, res): Promise<any> => {
  const { screenshotBase64, windowContext } = req.body ?? {};
  if (typeof screenshotBase64 !== 'string' || !screenshotBase64) {
    return res.status(400).json({ error: 'Missing screenshotBase64' });
  }

  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const args: any = await geminiService.inferScreen({ screenshotBase64, windowContext });
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

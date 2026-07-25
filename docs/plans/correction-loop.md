# Correction Loop Implementation Plan (Phase 0 + Phase 1)

> Source roadmap: `C:\Users\hhl_c\.claude\plans\i-want-to-work-peppy-wind.md`
> ("accurate, trustworthy automatic progress tracking"). This plan covers
> Phase 0 (unify the two attribution pathways) and Phase 1 (correction/trust
> loop) only. Phases 2-4 and the image-capture workstream are out of scope
> here.

**Goal:** Today, two independent pathways can silently mutate a task's
progress/status — `InferenceEngine` (writes a `summaries` row per action) and
`GitCommitTracker` (flips a task to `done` with no queryable record at all).
If either gets it wrong, there is no way to undo it. This plan (a) gives both
pathways a single auditable `summaries` record with enough data to reverse
their effect, then (b) adds an "Undo" / "Wrong task" correction UI in
`AIProgress.tsx` built directly on that record.

**Architecture:** Extend `summaries` (migration v6) with `source TEXT`,
`progress_delta REAL`, `previous_status TEXT`, `corrected INTEGER DEFAULT 0`.
`GitCommitTracker` gains a `SummariesRepo` dependency and now writes a
`source: 'commit_match'` row alongside its `done` flip. A new orchestration
module `app/src/main/store/correction.ts` (mirrors the existing
`planner/goal-manager.ts` pattern of thin functions that take repos + bus as
params) implements `undoSummary`/`reassignSummary` by reversing
`progress_delta`/`previous_status` against `TasksRepo`, then marking the
summary row `corrected = 1`. Two new IPC channels expose this; `AIProgress.tsx`
gets an Undo button and a "wrong task" reassign picker per timeline entry.

**Tech Stack:** TypeScript strict, better-sqlite3, existing bus + repo
patterns, React (renderer, inline styles matching the existing file).

## Global Constraints

- **Migration monotonic.** Current max is v5 (`app/src/main/store/db.ts`,
  the `progress` column). Next is v6. Match the existing migration entry
  shape exactly: `{ version: number; sql: string }` pushed onto the
  `MIGRATIONS` array — NOT the `{ version, up: (db) => ... }` shape (that
  shape does not exist in this codebase; don't invent it).
- **Repo root for this work is a worktree, not the primary checkout:**
  `C:\Users\hhl_c\AppData\Local\Temp\claude\D--GitHub-Plover\7bf45e42-1277-463d-8e75-aff36875eb32\scratchpad\Plover-correction-loop`
  on branch `feat/correction-loop` (branched from `origin/main`). Every
  subagent must `cd` into that exact path before touching files — do NOT
  operate on `D:\GitHub\Plover` (a different session may be using it
  concurrently; see CLAUDE.md's 2026-07-18 lesson).
- **Type safety:** `noUncheckedIndexedAccess` + `no-non-null-assertion` are
  on. In tests, destructure + optional-chain (`const [r0] = result; r0?.x`),
  never `result[0]!.x`.
- **No comments** unless the WHY is non-obvious.
- **Tests:** TDD every non-UI file in this plan (migration, repo, inference,
  git-commit-tracker, correction.ts, ipc handlers). The `AIProgress.tsx`
  change is UI-only — typecheck + manual verification, per CLAUDE.md's
  2026-07-17 lesson (Electron GUI can't be screenshotted from this tool on
  this Windows box).
- **Path-based pnpm filter.** `pnpm --filter ./app run <script>` for
  colon-named scripts, `pnpm --filter ./app <script>` otherwise.
- **`corrected` semantics:** applies to BOTH undo and reassign — once a
  summary row has had its effect reversed (by either action), mark it
  `corrected = 1` and never let it be corrected again (both `undoSummary` and
  `reassignSummary` must reject an already-corrected row).

## File Structure

```
app/src/main/store/
├── db.ts                        (modify: add migration v6 block)
├── correction.ts                (NEW: undoSummary / reassignSummary)
└── repos/
    └── summaries.ts             (modify: new columns, get/markCorrected/reassignTask)

app/src/main/activity/
├── inference.ts                 (modify: populate source/progress_delta/previous_status)
└── git-commit-tracker.ts        (modify: accept SummariesRepo, write commit_match row)

app/src/main/
├── ipc.ts                       (modify: summaries:undo, summaries:reassign handlers)
└── index.ts                     (modify: pass summariesRepo to GitCommitTracker)

app/src/main/planner/
└── goal-manager.ts              (modify: forward summary.corrected to app-event)

app/src/shared/
├── types.ts                     (modify: extend SummaryRow)
└── events.ts                    (modify: add 'summary.corrected' to EventPayloads)

app/src/preload/
└── index.ts                     (modify: undoSummary/reassignSummary on PloverApi)

app/src/renderer/main/pages/
└── AIProgress.tsx               (modify: Undo + reassign UI)

app/src/renderer/
└── index.css                    (modify: corrected-entry + action-button styles)

app/tests/store/
├── migrations-v6.test.ts        (NEW)
├── summaries-repo.test.ts       (modify: new columns, get/markCorrected/reassignTask)
└── correction.test.ts           (NEW)

app/tests/activity/
├── inference.test.ts            (modify: assert source/progress_delta/previous_status)
├── git-commit-tracker.test.ts   (modify: pass summariesRepo, assert commit_match row)
└── git-commit-tracker-security.test.ts (modify: pass summariesRepo to constructor)

app/tests/
├── ipc.test.ts                  (modify: assert summary.corrected forwarding)
└── main/ipc.test.ts             (modify: summaries:undo / summaries:reassign handler tests)
```

---

## Task 1: Migration v6 + shared types

**Files:**
- Modify: `app/src/main/store/db.ts`
- Modify: `app/src/shared/types.ts`
- Modify: `app/src/shared/events.ts`
- Create: `app/tests/store/migrations-v6.test.ts`

- [ ] **Step 1: Write the migration test**

Create `app/tests/store/migrations-v6.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';

describe('migration v6 — summaries attribution columns', () => {
  it('adds source/progress_delta/previous_status/corrected with correct defaults', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    db.prepare(
      `INSERT INTO goals (id, title, description, deadline, status, created_at, updated_at)
       VALUES ('g1', 'g', '', null, 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO tasks (id, goal_id, title, estimate_minutes, status, sort_index, created_at, updated_at)
       VALUES ('t1', 'g1', 'task', 30, 'todo', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO summaries (task_id, ts, summary, signal, source, progress_delta, previous_status)
       VALUES ('t1', '2026-01-01T00:00:00.000Z', 's', 0.5, 'inference', 25, 'todo')`,
    ).run();

    const row = db.prepare(`SELECT * FROM summaries WHERE task_id = 't1'`).get() as {
      source: string;
      progress_delta: number;
      previous_status: string;
      corrected: number;
    };
    expect(row.source).toBe('inference');
    expect(row.progress_delta).toBe(25);
    expect(row.previous_status).toBe('todo');
    expect(row.corrected).toBe(0);

    const userVersion = db.pragma('user_version', { simple: true }) as number;
    expect(userVersion).toBeUndefined; // placeholder removed below — see Step 3 note
  });
});
```

Note: this codebase tracks migration version via the `_migrations` table, not
SQLite's `user_version` pragma (see `runMigrations` in `db.ts`) — delete the
`userVersion`/placeholder lines above; they were left in as a reminder not to
invent a `user_version` check. Instead assert
`db.prepare('SELECT MAX(version) as v FROM _migrations').get()` equals `{ v: 6 }`
if you want a version assertion; it's optional since the column-existence
assertions above already prove the migration ran.

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/store/migrations-v6.test.ts
```
Expected: FAIL (columns don't exist yet).

- [ ] **Step 3: Add the migration**

In `app/src/main/store/db.ts`, append to the `MIGRATIONS` array after the v5
entry (match the exact `{ version, sql }` shape used by v5):

```ts
  {
    version: 6,
    sql: `
      ALTER TABLE summaries ADD COLUMN source TEXT NOT NULL DEFAULT 'inference';
      ALTER TABLE summaries ADD COLUMN progress_delta REAL;
      ALTER TABLE summaries ADD COLUMN previous_status TEXT;
      ALTER TABLE summaries ADD COLUMN corrected INTEGER NOT NULL DEFAULT 0;
    `,
  },
```

- [ ] **Step 4: Extend `SummaryRow` in `app/src/shared/types.ts`**

```ts
export interface SummaryRow {
  id: number;
  task_id: string | null;
  ts: string;
  summary: string;
  signal: number;
  source: 'inference' | 'commit_match';
  progress_delta: number | null;
  previous_status: string | null;
  corrected: 0 | 1;
}
```

- [ ] **Step 5: Add the new bus event to `app/src/shared/events.ts`**

Add one line to `EventPayloads`:
```ts
  'summary.corrected': SummaryRow;
```
(`SummaryRow` is already imported at the top of that file.)

- [ ] **Step 6: Verify PASS**

```bash
pnpm --filter ./app exec vitest run tests/store/migrations-v6.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/src/main/store/db.ts app/src/shared/types.ts app/src/shared/events.ts app/tests/store/migrations-v6.test.ts
git commit -m "feat(store): add summaries attribution columns (migration v6)"
```

---

## Task 2: SummariesRepo — new columns + get/markCorrected/reassignTask

**Files:**
- Modify: `app/src/main/store/repos/summaries.ts`
- Modify: `app/tests/store/summaries-repo.test.ts`

**Depends on:** Task 1 (needs the migration + `SummaryRow` type).

- [ ] **Step 1: Write the new tests**

Add to `app/tests/store/summaries-repo.test.ts` (reuse the existing
`seedTask` helper already in that file):

```ts
it('insert stores source/progress_delta/previous_status and defaults corrected to 0', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  seedTask(db, 'task-1');
  const repo = new SummariesRepo(db);

  const row = repo.insert({
    taskId: 'task-1',
    summary: 'evidence',
    signal: 0.5,
    source: 'inference',
    progressDelta: 25,
    previousStatus: 'todo',
  });

  expect(row.source).toBe('inference');
  expect(row.progress_delta).toBe(25);
  expect(row.previous_status).toBe('todo');
  expect(row.corrected).toBe(0);
});

it('insert defaults progressDelta/previousStatus to null when omitted', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  seedTask(db, 'task-1');
  const repo = new SummariesRepo(db);

  const row = repo.insert({
    taskId: 'task-1',
    summary: 'commit matched',
    signal: 1,
    source: 'commit_match',
  });

  expect(row.progress_delta).toBeNull();
  expect(row.previous_status).toBeNull();
});

it('get returns the full row including new columns, or null if missing', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  seedTask(db, 'task-1');
  const repo = new SummariesRepo(db);
  const inserted = repo.insert({
    taskId: 'task-1',
    summary: 'e',
    signal: 0.5,
    source: 'inference',
    progressDelta: 10,
    previousStatus: 'todo',
  });

  const fetched = repo.get(inserted.id);
  expect(fetched?.id).toBe(inserted.id);
  expect(fetched?.progress_delta).toBe(10);

  expect(repo.get(999999)).toBeNull();
});

it('markCorrected sets corrected to 1', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  seedTask(db, 'task-1');
  const repo = new SummariesRepo(db);
  const inserted = repo.insert({ taskId: 'task-1', summary: 'e', signal: 0.5, source: 'inference' });

  repo.markCorrected(inserted.id);

  expect(repo.get(inserted.id)?.corrected).toBe(1);
});

it('markCorrected throws for an unknown id', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  const repo = new SummariesRepo(db);
  expect(() => repo.markCorrected(999999)).toThrow();
});

it('reassignTask updates task_id and marks corrected', () => {
  const db = new Database(':memory:');
  runMigrations(db);
  seedTask(db, 'task-1');
  seedTask(db, 'task-2');
  const repo = new SummariesRepo(db);
  const inserted = repo.insert({ taskId: 'task-1', summary: 'e', signal: 0.5, source: 'inference' });

  repo.reassignTask(inserted.id, 'task-2');

  const updated = repo.get(inserted.id);
  expect(updated?.task_id).toBe('task-2');
  expect(updated?.corrected).toBe(1);
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/store/summaries-repo.test.ts
```

- [ ] **Step 3: Rewrite `app/src/main/store/repos/summaries.ts`**

Replace the file contents with:

```ts
import Database from 'better-sqlite3';
import { SummaryRow } from '../../../shared/types.js';

export class SummariesRepo {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private listForTaskStmt: Database.Statement;
  private listAllStmt: Database.Statement;
  private getStmt: Database.Statement;
  private markCorrectedStmt: Database.Statement;
  private reassignTaskStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = this.db.prepare(`
      INSERT INTO summaries (task_id, ts, summary, signal, source, progress_delta, previous_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.listForTaskStmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal, source, progress_delta, previous_status, corrected
      FROM summaries
      WHERE task_id = ?
      ORDER BY ts ASC
    `);
    this.listAllStmt = this.db.prepare(`
      SELECT s.id, s.task_id, s.ts, s.summary, s.signal, s.source, s.progress_delta,
             s.previous_status, s.corrected, t.title as task_title, g.title as goal_title
      FROM summaries s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN goals g ON t.goal_id = g.id
      ORDER BY s.ts DESC
    `);
    this.getStmt = this.db.prepare(`
      SELECT id, task_id, ts, summary, signal, source, progress_delta, previous_status, corrected
      FROM summaries
      WHERE id = ?
    `);
    this.markCorrectedStmt = this.db.prepare(`
      UPDATE summaries SET corrected = 1 WHERE id = ?
    `);
    this.reassignTaskStmt = this.db.prepare(`
      UPDATE summaries SET task_id = ?, corrected = 1 WHERE id = ?
    `);
  }

  insert(row: {
    taskId: string | null;
    summary: string;
    signal: number;
    source: 'inference' | 'commit_match';
    progressDelta?: number | null;
    previousStatus?: string | null;
    ts?: string;
  }): SummaryRow {
    const ts = row.ts || new Date().toISOString();
    const progressDelta = row.progressDelta ?? null;
    const previousStatus = row.previousStatus ?? null;
    const result = this.insertStmt.run(
      row.taskId,
      ts,
      row.summary,
      row.signal,
      row.source,
      progressDelta,
      previousStatus,
    );

    return {
      id: result.lastInsertRowid as number,
      task_id: row.taskId,
      ts,
      summary: row.summary,
      signal: row.signal,
      source: row.source,
      progress_delta: progressDelta,
      previous_status: previousStatus,
      corrected: 0,
    };
  }

  get(id: number): SummaryRow | null {
    const row = this.getStmt.get(id) as SummaryRow | undefined;
    return row ?? null;
  }

  listForTask(taskId: string): SummaryRow[] {
    return this.listForTaskStmt.all(taskId) as SummaryRow[];
  }

  listAll(): (SummaryRow & { task_title: string | null; goal_title: string | null })[] {
    return this.listAllStmt.all() as (SummaryRow & {
      task_title: string | null;
      goal_title: string | null;
    })[];
  }

  markCorrected(id: number): void {
    const info = this.markCorrectedStmt.run(id);
    if (info.changes === 0) {
      throw new Error(`Summary with id ${id} not found`);
    }
  }

  reassignTask(id: number, newTaskId: string): void {
    const info = this.reassignTaskStmt.run(newTaskId, id);
    if (info.changes === 0) {
      throw new Error(`Summary with id ${id} not found`);
    }
  }
}
```

Note this drops the standalone `SummaryRow` interface that used to live in
this file (it now lives in `app/src/shared/types.ts` per Task 1 — check for
any other file importing `SummaryRow` from
`main/store/repos/summaries.js` specifically and repoint it to
`shared/types.js`; `grep -rn "from '.*repos/summaries" app/src` to confirm
before finishing this step).

- [ ] **Step 4: Verify PASS**

```bash
pnpm --filter ./app exec vitest run tests/store/summaries-repo.test.ts
```

- [ ] **Step 5: Full suite still green**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 6: Commit**

```bash
git add app/src/main/store/repos/summaries.ts app/tests/store/summaries-repo.test.ts
git commit -m "feat(store): SummariesRepo get/markCorrected/reassignTask"
```

---

## Task 3: InferenceEngine — populate attribution columns

**Files:**
- Modify: `app/src/main/activity/inference.ts`
- Modify: `app/tests/activity/inference.test.ts`

**Depends on:** Task 1 + Task 2.

- [ ] **Step 1: Extend the existing "marks a task done" test**

In `app/tests/activity/inference.test.ts`, extend the first test (`marks a
task done when the server says completed=true and writes a summary`) with
extra assertions after the existing `summaries` checks:

```ts
    expect(s0?.source).toBe('inference');
    expect(s0?.progress_delta).toBe(100);
    expect(s0?.previous_status).toBe('todo');
```

Add one more test:

```ts
it('captures previous_status as the pre-pass status, not post-completion status', async () => {
  const { tasksRepo, goalsRepo, activityRepo, summariesRepo, engine } = freshHarness();
  const { taskId } = seedGoalAndTask(goalsRepo, tasksRepo, 'Partial progress task');
  activityRepo.insert({
    kind: 'file_modified',
    payload: { path: '/src/a.ts' },
    ts: '2026-06-12T10:00:00.000Z',
  });

  fetchSpy.mockResolvedValue(
    new Response(
      JSON.stringify({
        task_progress: [
          { taskId, progress_increment: 40, completed: false, reasoning: 'partial work' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );

  await engine.runInferencePass();

  const [s0] = summariesRepo.listForTask(taskId);
  expect(s0?.source).toBe('inference');
  expect(s0?.progress_delta).toBe(40);
  expect(s0?.previous_status).toBe('todo');
  expect(tasksRepo.get(taskId)?.status).toBe('todo');
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/activity/inference.test.ts
```

- [ ] **Step 3: Update `runInferencePass` in `app/src/main/activity/inference.ts`**

Replace the loop body (currently lines ~97-117) with:

```ts
    const validIds = new Set(activeTasks.map((t) => t.id));
    for (const entry of payload.task_progress) {
      if (!validIds.has(entry.taskId)) continue;

      const increment = entry.progress_increment ?? 0;
      const updated = this.tasksRepo.incrementProgress(entry.taskId, increment);
      const previousStatus = updated.status;

      const shouldComplete = entry.completed || updated.progress >= 100;
      if (shouldComplete && updated.status !== 'done') {
        const done = this.tasksRepo.update(entry.taskId, { status: 'done' });
        this.bus.emit('task.completed', done);
      }

      const inserted = this.summariesRepo.insert({
        taskId: entry.taskId,
        summary: entry.reasoning,
        signal: Math.min(1, Math.max(0, increment / 100)),
        source: 'inference',
        progressDelta: increment,
        previousStatus,
        ts: nowTs,
      });
      this.bus.emit('summary.created', inserted);
    }
```

(Only the additions are `previousStatus` capture right after
`incrementProgress` — before the possible status flip — and the two new
`insert()` fields. The rest is unchanged.)

- [ ] **Step 4: Verify PASS, then full suite**

```bash
pnpm --filter ./app exec vitest run tests/activity/inference.test.ts
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 5: Commit**

```bash
git add app/src/main/activity/inference.ts app/tests/activity/inference.test.ts
git commit -m "feat(inference): record source/progress_delta/previous_status on summaries"
```

---

## Task 4: GitCommitTracker — write a commit_match summary row

**Files:**
- Modify: `app/src/main/activity/git-commit-tracker.ts`
- Modify: `app/src/main/index.ts` (constructor call site)
- Modify: `app/tests/activity/git-commit-tracker.test.ts`
- Modify: `app/tests/activity/git-commit-tracker-security.test.ts`

**Depends on:** Task 1 + Task 2. Independent of Task 3 (can run in parallel).

- [ ] **Step 1: Update test harnesses to pass a `SummariesRepo`**

In `app/tests/activity/git-commit-tracker.test.ts`, the `Harness` interface
and `freshHarness()` currently construct
`new GitCommitTracker(tasksRepo, activityRepo, bus, matcherSpy, notifySpy)`.
Add a `SummariesRepo` as the 4th positional constructor argument (matcher and
notify shift to 5th/6th):

```ts
import { SummariesRepo } from '@main/store/repos/summaries.js';

interface Harness {
  db: Database.Database;
  tasksRepo: TasksRepo;
  goalsRepo: GoalsRepo;
  activityRepo: ActivityRepo;
  summariesRepo: SummariesRepo;
  bus: TypedEventBus;
  notifySpy: ReturnType<typeof vi.fn>;
  matcherSpy: ReturnType<typeof vi.fn>;
  tracker: GitCommitTracker;
}

function freshHarness(matcherImpl?: CommitMatcher): Harness {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const activityRepo = new ActivityRepo(db);
  const summariesRepo = new SummariesRepo(db);
  const bus = new TypedEventBus();
  const notifySpy = vi.fn();
  const matcherSpy = vi.fn(
    matcherImpl ??
      (async () => ({ matchedTaskId: null, reasoning: 'no match' }) as MatchCommitResponse),
  );
  const tracker = new GitCommitTracker(
    tasksRepo,
    activityRepo,
    bus,
    summariesRepo,
    matcherSpy as unknown as CommitMatcher,
    notifySpy,
  );
  tracker.start();
  return { db, tasksRepo, goalsRepo, activityRepo, summariesRepo, bus, notifySpy, matcherSpy, tracker };
}
```

Then add one new test in the `describe('GitCommitTracker', ...)` block (near
the existing "marks the matched task done" test — read that test first to
copy its commit/matcher setup pattern exactly):

```ts
it('writes a commit_match summary row with previous_status captured pre-update', async () => {
  harness = freshHarness();
  const { taskId } = seedTask(harness, 'Implement AST generator');
  harness.matcherSpy.mockResolvedValue({
    matchedTaskId: taskId,
    reasoning: 'Commit message references AST generator',
  });

  await makeCommit(repo.repoPath, 'feat: implement AST generator');
  await execFileAsync('git', [
    '-C', repo.repoPath, 'log', '-1', '--pretty=format:%H',
  ]); // ensure commit landed before triggering the watcher event below

  // Trigger the same way the existing "marks the matched task done" test
  // does — read that test's bus.emit('folder.file_changed', ...) call and
  // copy it verbatim here, pointing at repo.repoPath's COMMIT_EDITMSG.

  const [summary] = harness.summariesRepo.listForTask(taskId);
  expect(summary?.source).toBe('commit_match');
  expect(summary?.signal).toBe(1);
  expect(summary?.previous_status).toBe('todo');
  expect(summary?.progress_delta).toBeNull();
  expect(summary?.summary).toBe('Commit message references AST generator');
});
```

**Implementation note for whoever picks this up:** the exact trigger
mechanism (how the existing tests fire `folder.file_changed` /
`folder.file_added` to simulate a commit) isn't reproduced here verbatim —
copy it from the existing passing test immediately above this one in the same
file rather than guessing the event shape.

In `app/tests/activity/git-commit-tracker-security.test.ts`, find the single
`new GitCommitTracker(tasksRepo, activityRepo, bus)` call and add a
`SummariesRepo` instance as the 4th argument:
```ts
const summariesRepo = new SummariesRepo(db);
tracker = new GitCommitTracker(tasksRepo, activityRepo, bus, summariesRepo);
```
(Add the `SummariesRepo` import and instantiate it from whatever `db`
variable that test file already has in scope.)

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/activity/git-commit-tracker.test.ts tests/activity/git-commit-tracker-security.test.ts
```

- [ ] **Step 3: Update `GitCommitTracker`**

In `app/src/main/activity/git-commit-tracker.ts`:

1. Add the import: `import { SummariesRepo } from '../store/repos/summaries.js';`
2. Add `private summariesRepo: SummariesRepo,` as the 4th constructor
   parameter, before `matchCommit` and `notify` (which have defaults):

```ts
  constructor(
    private tasksRepo: TasksRepo,
    private activityRepo: ActivityRepo,
    private bus: TypedEventBus,
    private summariesRepo: SummariesRepo,
    private matchCommit: CommitMatcher = defaultMatchCommit,
    private notify: (title: string, body: string) => void = defaultNotify,
  ) {}
```

3. In `handleCommitEvent`, replace:

```ts
      const matched = activeTasks.find((t) => t.id === result.matchedTaskId);
      if (!matched) return;

      const updated = this.tasksRepo.update(matched.id, { status: 'done' });
      if (updated) {
        this.bus.emit('task.completed', updated);
      }
      this.notify('Plover', `Marked "${matched.title}" as done based on your git commit.`);
```

with:

```ts
      const matched = activeTasks.find((t) => t.id === result.matchedTaskId);
      if (!matched) return;

      const previousStatus = matched.status;
      const updated = this.tasksRepo.update(matched.id, { status: 'done' });
      if (updated) {
        this.bus.emit('task.completed', updated);
      }

      const inserted = this.summariesRepo.insert({
        taskId: matched.id,
        summary: result.reasoning ?? `Matched to commit ${commit.hash.slice(0, 7)}`,
        signal: 1,
        source: 'commit_match',
        previousStatus,
        ts: new Date().toISOString(),
      });
      this.bus.emit('summary.created', inserted);

      this.notify('Plover', `Marked "${matched.title}" as done based on your git commit.`);
```

- [ ] **Step 4: Update the production wiring in `app/src/main/index.ts`**

Find `gitCommitTracker = new GitCommitTracker(tasksRepo, activityRepo,
eventBus);` and change to:
```ts
gitCommitTracker = new GitCommitTracker(tasksRepo, activityRepo, eventBus, summariesRepo);
```
(`summariesRepo` is already imported in that file — check the existing
import line and add it if it isn't already there; `inference.ts`'s
instantiation a few lines above already uses it.)

- [ ] **Step 5: Verify PASS, then full suite**

```bash
pnpm --filter ./app exec vitest run tests/activity/git-commit-tracker.test.ts tests/activity/git-commit-tracker-security.test.ts
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 6: Commit**

```bash
git add app/src/main/activity/git-commit-tracker.ts app/src/main/index.ts app/tests/activity/git-commit-tracker.test.ts app/tests/activity/git-commit-tracker-security.test.ts
git commit -m "feat(git-commit-tracker): record commit_match summaries row"
```

---

## Task 5: `correction.ts` — undoSummary / reassignSummary

**Files:**
- Create: `app/src/main/store/correction.ts`
- Create: `app/tests/store/correction.test.ts`

**Depends on:** Task 1 + Task 2. Independent of Tasks 3-4 (can run in
parallel — it only touches `TasksRepo`/`SummariesRepo`, not the two tracker
files).

- [ ] **Step 1: Write the test file**

Create `app/tests/store/correction.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { TasksRepo } from '@main/store/repos/tasks.js';
import { GoalsRepo } from '@main/store/repos/goals.js';
import { SummariesRepo } from '@main/store/repos/summaries.js';
import { TypedEventBus } from '@main/events/bus.js';
import { undoSummary, reassignSummary } from '@main/store/correction.js';

function harness() {
  const db = new Database(':memory:');
  runMigrations(db);
  const tasksRepo = new TasksRepo(db);
  const goalsRepo = new GoalsRepo(db);
  const summariesRepo = new SummariesRepo(db);
  const bus = new TypedEventBus();
  const goal = goalsRepo.create({ title: 'Test goal', status: 'active' });
  return { db, tasksRepo, goalsRepo, summariesRepo, bus, goalId: goal.id };
}

describe('undoSummary', () => {
  it('reverses a progress_delta and restores previous_status', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId, title: 't', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    tasksRepo.incrementProgress(task.id, 60);
    const summary = summariesRepo.insert({
      taskId: task.id, summary: 'e', signal: 0.6, source: 'inference',
      progressDelta: 60, previousStatus: 'todo',
    });

    const result = undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(result.corrected).toBe(1);
    expect(tasksRepo.get(task.id)?.progress).toBe(0);
    expect(tasksRepo.get(task.id)?.status).toBe('todo');
  });

  it('restores status for a commit_match row with no progress_delta', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId, title: 't', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    tasksRepo.update(task.id, { status: 'done' });
    const summary = summariesRepo.insert({
      taskId: task.id, summary: 'matched commit', signal: 1, source: 'commit_match',
      previousStatus: 'todo',
    });

    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(tasksRepo.get(task.id)?.status).toBe('todo');
  });

  it('emits summary.corrected', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId, title: 't', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: task.id, summary: 'e', signal: 0.5, source: 'inference',
      progressDelta: 30, previousStatus: 'todo',
    });

    let emitted: unknown = null;
    bus.on('summary.corrected', (s) => { emitted = s; });
    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(emitted).not.toBeNull();
  });

  it('throws for an already-corrected summary', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const task = tasksRepo.create({
      goal_id: goalId, title: 't', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: task.id, summary: 'e', signal: 0.5, source: 'inference', progressDelta: 10, previousStatus: 'todo',
    });
    undoSummary(tasksRepo, summariesRepo, bus, summary.id);

    expect(() => undoSummary(tasksRepo, summariesRepo, bus, summary.id)).toThrow();
  });

  it('throws for an unknown summary id', () => {
    const { tasksRepo, summariesRepo, bus } = harness();
    expect(() => undoSummary(tasksRepo, summariesRepo, bus, 999999)).toThrow();
  });
});

describe('reassignSummary', () => {
  it('moves a progress_delta from the old task to the new task', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId, title: 'old', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId, title: 'new', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    tasksRepo.incrementProgress(oldTask.id, 40);
    const summary = summariesRepo.insert({
      taskId: oldTask.id, summary: 'e', signal: 0.4, source: 'inference',
      progressDelta: 40, previousStatus: 'todo',
    });

    const result = reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(result.task_id).toBe(newTask.id);
    expect(result.corrected).toBe(1);
    expect(tasksRepo.get(oldTask.id)?.progress).toBe(0);
    expect(tasksRepo.get(newTask.id)?.progress).toBe(40);
  });

  it('auto-completes the new task if the reapplied delta reaches 100', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId, title: 'old', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId, title: 'new', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    tasksRepo.incrementProgress(oldTask.id, 100);
    const summary = summariesRepo.insert({
      taskId: oldTask.id, summary: 'e', signal: 1, source: 'inference',
      progressDelta: 100, previousStatus: 'todo',
    });

    reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(tasksRepo.get(newTask.id)?.status).toBe('done');
  });

  it('re-flips the new task to done for a commit_match reassignment', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId, title: 'old', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const newTask = tasksRepo.create({
      goal_id: goalId, title: 'new', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    tasksRepo.update(oldTask.id, { status: 'done' });
    const summary = summariesRepo.insert({
      taskId: oldTask.id, summary: 'matched', signal: 1, source: 'commit_match', previousStatus: 'todo',
    });

    reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id);

    expect(tasksRepo.get(oldTask.id)?.status).toBe('todo');
    expect(tasksRepo.get(newTask.id)?.status).toBe('done');
  });

  it('throws when reassigning a summary with no originating task', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const newTask = tasksRepo.create({
      goal_id: goalId, title: 'new', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const summary = summariesRepo.insert({ taskId: null, summary: 'global', signal: 0.5, source: 'inference' });

    expect(() => reassignSummary(tasksRepo, summariesRepo, bus, summary.id, newTask.id)).toThrow();
  });

  it('throws when the target task does not exist', () => {
    const { tasksRepo, summariesRepo, bus, goalId } = harness();
    const oldTask = tasksRepo.create({
      goal_id: goalId, title: 'old', estimate_minutes: 30, status: 'todo', depends_on: [],
    });
    const summary = summariesRepo.insert({
      taskId: oldTask.id, summary: 'e', signal: 0.5, source: 'inference', progressDelta: 10, previousStatus: 'todo',
    });

    expect(() =>
      reassignSummary(tasksRepo, summariesRepo, bus, summary.id, 'nonexistent-task'),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/store/correction.test.ts
```
Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Create `app/src/main/store/correction.ts`**

```ts
import { Task } from '../../shared/types.js';
import { SummaryRow } from '../../shared/types.js';
import { TasksRepo } from './repos/tasks.js';
import { SummariesRepo } from './repos/summaries.js';
import { TypedEventBus } from '../events/bus.js';

function reverseEffect(tasksRepo: TasksRepo, row: SummaryRow): void {
  if (!row.task_id) return;
  if (row.progress_delta !== null) {
    tasksRepo.incrementProgress(row.task_id, -row.progress_delta);
  }
  if (row.previous_status !== null) {
    tasksRepo.update(row.task_id, { status: row.previous_status as Task['status'] });
  }
}

function applyEffect(
  tasksRepo: TasksRepo,
  bus: TypedEventBus,
  taskId: string,
  row: SummaryRow,
): void {
  if (row.progress_delta !== null) {
    const updated = tasksRepo.incrementProgress(taskId, row.progress_delta);
    if (updated.progress >= 100 && updated.status !== 'done') {
      const done = tasksRepo.update(taskId, { status: 'done' });
      bus.emit('task.completed', done);
    }
    return;
  }
  const done = tasksRepo.update(taskId, { status: 'done' });
  bus.emit('task.completed', done);
}

function requireSummary(summariesRepo: SummariesRepo, summaryId: number): SummaryRow {
  const row = summariesRepo.get(summaryId);
  if (!row) {
    throw new Error(`Summary with id ${summaryId} not found`);
  }
  if (row.corrected) {
    throw new Error(`Summary ${summaryId} was already corrected`);
  }
  return row;
}

export function undoSummary(
  tasksRepo: TasksRepo,
  summariesRepo: SummariesRepo,
  bus: TypedEventBus,
  summaryId: number,
): SummaryRow {
  const row = requireSummary(summariesRepo, summaryId);

  reverseEffect(tasksRepo, row);
  summariesRepo.markCorrected(summaryId);

  const updated = summariesRepo.get(summaryId);
  if (!updated) {
    throw new Error(`Summary with id ${summaryId} not found after update`);
  }
  bus.emit('summary.corrected', updated);
  return updated;
}

export function reassignSummary(
  tasksRepo: TasksRepo,
  summariesRepo: SummariesRepo,
  bus: TypedEventBus,
  summaryId: number,
  newTaskId: string,
): SummaryRow {
  const row = requireSummary(summariesRepo, summaryId);
  if (!row.task_id) {
    throw new Error(`Summary ${summaryId} has no originating task to reassign from`);
  }
  if (!tasksRepo.get(newTaskId)) {
    throw new Error(`Task with id ${newTaskId} not found`);
  }

  reverseEffect(tasksRepo, row);
  applyEffect(tasksRepo, bus, newTaskId, row);
  summariesRepo.reassignTask(summaryId, newTaskId);

  const updated = summariesRepo.get(summaryId);
  if (!updated) {
    throw new Error(`Summary with id ${summaryId} not found after update`);
  }
  bus.emit('summary.corrected', updated);
  return updated;
}
```

- [ ] **Step 4: Verify PASS, then full suite**

```bash
pnpm --filter ./app exec vitest run tests/store/correction.test.ts
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 5: Commit**

```bash
git add app/src/main/store/correction.ts app/tests/store/correction.test.ts
git commit -m "feat(store): undoSummary/reassignSummary correction logic"
```

---

## Task 6: IPC handlers + event forwarding

**Files:**
- Modify: `app/src/main/ipc.ts`
- Modify: `app/src/main/planner/goal-manager.ts`
- Modify: `app/tests/main/ipc.test.ts`
- Modify: `app/tests/ipc.test.ts`

**Depends on:** Task 5 (needs `correction.ts`). Should land after Tasks 3-4
are merged too, since it's the integration point, but doesn't directly touch
their files — safe to implement in parallel and rebase.

- [ ] **Step 1: Add the event-forwarding test**

In `app/tests/ipc.test.ts`, find the existing test(s) in the `describe('Event
forwarding', ...)` block that assert `eventBus.emit('summary.created', ...)`
→ `webContents.send('app-event', ...)` (search for `'summary.created'` in
that file to find the exact pattern), and add an equivalent test for
`summary.corrected`:

```ts
it('forwards summary.corrected events', () => {
  const broadcast = (channel: string, payload?: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  };
  startEventForwarding(broadcast);

  const summary = {
    id: 1, task_id: 't1', ts: '2026-01-01T00:00:00.000Z', summary: 'e', signal: 0.5,
    source: 'inference', progress_delta: null, previous_status: 'todo', corrected: 1,
  };
  eventBus.emit('summary.corrected', summary);

  const [win] = BrowserWindow.getAllWindows();
  expect(win.webContents.send).toHaveBeenCalledWith('app-event', {
    type: 'summary.corrected',
    payload: summary,
  });
});
```
(Match whatever exact assertion style the existing `summary.created` test in
this file already uses — copy its structure rather than the sketch above if
they differ.)

- [ ] **Step 2: Add the IPC handler tests**

In `app/tests/main/ipc.test.ts`, find the `describe('tasks:updateStatus
handler', ...)` block (used above as the reference pattern) and add a new
`describe` block near it, using whatever `seedTask`/`getHandler` helpers that
file already defines:

```ts
describe('summaries:undo / summaries:reassign handlers', () => {
  it('summaries:undo reverses a progress-based summary', async () => {
    const { task } = seedTask();
    tasksRepo.incrementProgress(task.id, 50);
    const summary = summariesRepo.insert({
      taskId: task.id, summary: 'e', signal: 0.5, source: 'inference',
      progressDelta: 50, previousStatus: 'todo',
    });

    const handler = getHandler('summaries:undo');
    const result = (await handler({}, summary.id)) as { corrected: number };

    expect(result.corrected).toBe(1);
    expect(tasksRepo.get(task.id)?.progress).toBe(0);
  });

  it('summaries:reassign moves the effect to a new task', async () => {
    const { task: oldTask } = seedTask();
    const { task: newTask } = seedTask();
    tasksRepo.incrementProgress(oldTask.id, 30);
    const summary = summariesRepo.insert({
      taskId: oldTask.id, summary: 'e', signal: 0.3, source: 'inference',
      progressDelta: 30, previousStatus: 'todo',
    });

    const handler = getHandler('summaries:reassign');
    const result = (await handler({}, summary.id, newTask.id)) as { task_id: string };

    expect(result.task_id).toBe(newTask.id);
    expect(tasksRepo.get(newTask.id)?.progress).toBe(30);
  });
});
```

Check the top of `app/tests/main/ipc.test.ts` for how `summariesRepo` is
imported/accessed (it currently imports `goalsRepo, tasksRepo, settingsRepo,
activityRepo` from `../../src/main/store` — add `summariesRepo` to that
import list) and how `seedTask()` is defined/used elsewhere in the file;
reuse it rather than redefining.

- [ ] **Step 3: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/ipc.test.ts tests/main/ipc.test.ts
```

- [ ] **Step 4: Add the IPC handlers**

In `app/src/main/ipc.ts`, add the import:
```ts
import { undoSummary, reassignSummary } from './store/correction.js';
```

Then, immediately after the existing `summaries:get` handler:
```ts
  // Summaries
  ipcMain.handle('summaries:get', async () => {
    return summariesRepo.listAll();
  });

  ipcMain.handle('summaries:undo', async (_, summaryId: number) => {
    return undoSummary(tasksRepo, summariesRepo, eventBus, summaryId);
  });

  ipcMain.handle('summaries:reassign', async (_, summaryId: number, newTaskId: string) => {
    return reassignSummary(tasksRepo, summariesRepo, eventBus, summaryId, newTaskId);
  });
```

- [ ] **Step 5: Forward `summary.corrected` in `goal-manager.ts`**

In `app/src/main/planner/goal-manager.ts`'s `startEventForwarding`, add
after the existing `summary.created` handler:
```ts
  eventBus.on('summary.corrected', (summary: SummaryRow) => {
    broadcast('app-event', { type: 'summary.corrected', payload: summary });
  });
```
(`SummaryRow` is already imported in this file for the `summary.created`
handler above it.)

- [ ] **Step 6: Verify PASS, then full suite**

```bash
pnpm --filter ./app exec vitest run tests/ipc.test.ts tests/main/ipc.test.ts
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 7: Commit**

```bash
git add app/src/main/ipc.ts app/src/main/planner/goal-manager.ts app/tests/ipc.test.ts app/tests/main/ipc.test.ts
git commit -m "feat(ipc): summaries:undo and summaries:reassign handlers"
```

---

## Task 7: Preload API surface

**Files:**
- Modify: `app/src/preload/index.ts`

**Depends on:** Task 6 (channels must exist).

- [ ] **Step 1: Extend `PloverApi` interface**

Add to the interface, near `getSummaries`:
```ts
  undoSummary: (summaryId: number) => Promise<SummaryRow>;
  reassignSummary: (summaryId: number, newTaskId: string) => Promise<SummaryRow>;
```

- [ ] **Step 2: Extend the `api` implementation object**

Add, near `getSummaries: () => ipcRenderer.invoke('summaries:get'),`:
```ts
  undoSummary: (summaryId) => ipcRenderer.invoke('summaries:undo', summaryId),
  reassignSummary: (summaryId, newTaskId) =>
    ipcRenderer.invoke('summaries:reassign', summaryId, newTaskId),
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter ./app run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/src/preload/index.ts
git commit -m "feat(preload): expose undoSummary/reassignSummary"
```

---

## Task 8: AIProgress.tsx — Undo + reassign UI

**Files:**
- Modify: `app/src/renderer/main/pages/AIProgress.tsx`
- Modify: `app/src/renderer/index.css`

**Depends on:** Task 7.

- [ ] **Step 1: Add task list state + fetch**

In `AIProgress.tsx`, add a second piece of state for the active-task picker
and fetch it alongside summaries:

```tsx
import { Task, SummaryRow } from '../../../shared/types';
// ...
  const [summaries, setSummaries] = useState<JoinedSummary[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummaries = useCallback(async () => {
    try {
      const [summaryData, taskData] = await Promise.all([
        window.api.getSummaries(),
        window.api.getTasks(),
      ]);
      setSummaries(summaryData);
      setActiveTasks(taskData.filter((t) => t.status === 'todo' || t.status === 'scheduled'));
    } catch (err) {
      console.error('Failed to load AI progress summaries:', err);
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 2: Trigger refetch on `summary.corrected`**

Update the `app-event` listener's condition:
```tsx
      if (
        appEvent.type === 'summary.created' ||
        appEvent.type === 'summary.corrected' ||
        appEvent.type === 'task.completed'
      ) {
        void fetchSummaries();
      }
```

- [ ] **Step 3: Add undo/reassign handlers**

Add inside the component, before the `return`:
```tsx
  const handleUndo = useCallback(async (summaryId: number) => {
    try {
      await window.api.undoSummary(summaryId);
      await fetchSummaries();
    } catch (err) {
      console.error('Failed to undo summary:', err);
    }
  }, [fetchSummaries]);

  const handleReassign = useCallback(
    async (summaryId: number, newTaskId: string) => {
      if (!newTaskId) return;
      try {
        await window.api.reassignSummary(summaryId, newTaskId);
        await fetchSummaries();
      } catch (err) {
        console.error('Failed to reassign summary:', err);
      }
    },
    [fetchSummaries],
  );
```

- [ ] **Step 4: Render Undo/reassign controls per hit**

Replace the `hit.hits.map((hit) => ( ... ))` block's inner JSX. Current:
```tsx
                      {pass.hits.map((hit) => (
                        <div key={hit.id} className="timeline-feed-hit">
                          <div className="timeline-feed-hit-header">
                            <div className="timeline-feed-tags">
                              {hit.goal_title && (
                                <span className="timeline-feed-tag-goal">{hit.goal_title}</span>
                              )}
                              {hit.task_title && (
                                <span className="timeline-feed-tag-task">{hit.task_title}</span>
                              )}
                            </div>
                          </div>
                          <p className="timeline-feed-reasoning">"{hit.summary}"</p>
                        </div>
                      ))}
```
New:
```tsx
                      {pass.hits.map((hit) => (
                        <div
                          key={hit.id}
                          className={`timeline-feed-hit${hit.corrected ? ' timeline-feed-hit--corrected' : ''}`}
                        >
                          <div className="timeline-feed-hit-header">
                            <div className="timeline-feed-tags">
                              {hit.goal_title && (
                                <span className="timeline-feed-tag-goal">{hit.goal_title}</span>
                              )}
                              {hit.task_title && (
                                <span className="timeline-feed-tag-task">{hit.task_title}</span>
                              )}
                            </div>
                          </div>
                          <p className="timeline-feed-reasoning">"{hit.summary}"</p>
                          {hit.corrected ? (
                            <span className="timeline-feed-corrected-label">Corrected</span>
                          ) : hit.task_id ? (
                            <div className="timeline-feed-hit-actions">
                              <button
                                type="button"
                                className="timeline-feed-action-btn"
                                onClick={() => void handleUndo(hit.id)}
                              >
                                Undo
                              </button>
                              <select
                                className="timeline-feed-reassign-select"
                                value=""
                                onChange={(e) => void handleReassign(hit.id, e.target.value)}
                              >
                                <option value="" disabled>
                                  Wrong task?
                                </option>
                                {activeTasks
                                  .filter((t) => t.id !== hit.task_id)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.title}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      ))}
```

Note: `hit` is typed as `JoinedSummary = SummaryRow & { task_title, goal_title
}` — after Task 1's `SummaryRow` extension, `hit.corrected` and
`hit.task_id` are already in scope with no further type changes needed here.

- [ ] **Step 5: Add CSS**

In `app/src/renderer/index.css`, add after the existing `.timeline-feed-hit`
rule (around line 1454):
```css
.timeline-feed-hit--corrected {
  opacity: 0.55;
}

.timeline-feed-hit--corrected .timeline-feed-reasoning {
  text-decoration: line-through;
}

.timeline-feed-corrected-label {
  font-size: 11px;
  color: var(--plover-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.timeline-feed-hit-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.timeline-feed-action-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--plover-border);
  border-radius: var(--plover-radius-sm);
  color: var(--plover-text-muted);
  cursor: pointer;
}

.timeline-feed-action-btn:hover {
  border-color: var(--plover-text-muted);
  color: var(--plover-text);
}

.timeline-feed-reassign-select {
  font-size: 12px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--plover-border);
  border-radius: var(--plover-radius-sm);
  color: var(--plover-text-muted);
}
```

- [ ] **Step 6: Typecheck + lint**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint
```

- [ ] **Step 7: Manual verification (document, don't attempt via automated tooling)**

Per CLAUDE.md's 2026-07-17 lesson, this tool cannot launch/screenshot the
Electron GUI on this Windows box. Document in the commit message that manual
verification is needed: run `pnpm dev`, open AI Progress, and confirm (a) an
inference-sourced entry shows Undo + a "Wrong task?" picker, (b) clicking
Undo reverts the task's progress bar on Goals and removes the entry's
active-looking styling in favor of strikethrough + "Corrected", (c) picking
a task from "Wrong task?" moves the credit to that task.

- [ ] **Step 8: Commit**

```bash
git add app/src/renderer/main/pages/AIProgress.tsx app/src/renderer/index.css
git commit -m "feat(ui): AIProgress undo + reassign controls"
```

---

## Task 9: Push + open PR

- [ ] **Step 1: Full verification from repo root**

```bash
pnpm typecheck && pnpm lint && pnpm test
```
Run this from the worktree root (the repo root delegates into `app/` per
CLAUDE.md's command table).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/correction-loop
gh pr create --title "feat: correction loop for AI progress attribution" --body "$(cat <<'EOF'
## Summary
- Migration v6 extends `summaries` with `source`, `progress_delta`,
  `previous_status`, `corrected` — one auditable record for both attribution
  pathways.
- `GitCommitTracker` now writes a `source: 'commit_match'` summaries row
  alongside its `done` flip (previously silent/unrecorded).
- `InferenceEngine` populates the same columns per `progress_increment` pass.
- New `undoSummary`/`reassignSummary` (`app/src/main/store/correction.ts`)
  reverse a summary's effect on its task, or move it to a different task —
  exposed via `summaries:undo` / `summaries:reassign` IPC.
- `AIProgress.tsx` gets an Undo button and a "Wrong task?" picker per
  timeline entry; corrected entries render struck-through instead of being
  deleted, keeping the timeline an honest record.

Scoped to Phase 0 + Phase 1 of the attribution-accuracy roadmap
(`i-want-to-work-peppy-wind.md`) — richer LLM context, hysteresis on
auto-completion, and server-side confidence scores are separate follow-ups.

## Test plan
- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] `pnpm test` green (migration v6, SummariesRepo, InferenceEngine,
      GitCommitTracker, correction.ts, IPC handlers)
- [ ] Manual: `pnpm dev` — Undo an inference entry, confirm the goal's
      progress bar drops accordingly; reassign an entry to a different task
      and confirm the target task's progress moves and the entry renders
      "Corrected"

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back**

## Self-Review Notes

1. **Spec coverage:** All of Phase 0's four bullets (schema extension,
   inference populates columns, commit-tracker writes a row, "no UI changes
   this phase") and Phase 1's two bullets (`summaries:undo`,
   `summaries:reassign`, corrected entries shown not removed) are covered by
   Tasks 1-8.
2. **Two-pathway symmetry:** Both `undoSummary` and `reassignSummary` handle
   the `progress_delta === null` (commit_match) case via direct status
   restore/flip, and the `progress_delta !== null` (inference) case via
   `incrementProgress` — verified by dedicated tests in Task 5 for both
   branches, in both functions.
3. **Constructor signature change risk:** `GitCommitTracker` gaining a new
   positional constructor parameter is a breaking change to every call site.
   Task 4 explicitly enumerates all three affected files (`index.ts` +
   2 test files) found via the codebase read that produced this plan —
   `git-commit-tracker-notify.test.ts` was checked and does NOT construct a
   `GitCommitTracker` (it only tests the standalone `defaultNotify` export),
   so it's correctly excluded from the file list.
4. **Ordering:** Tasks 3 and 4 both depend only on 1+2 and are independent of
   each other — dispatch them in parallel. Task 5 is also independent of 3/4.
   Task 6 depends on 5 (imports `correction.ts`) but not on 3/4's internals
   (only on the `SummaryRow` shape from Task 1). Tasks 7/8 are strictly
   sequential after 6.

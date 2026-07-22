# Task Progress Accumulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `+X% Progress` numbers shown on the AI Progress timeline actually accumulate — filling the per-goal progress bar smoothly and auto-marking a task done when it reaches 100.

**Architecture:** Add a `progress REAL NOT NULL DEFAULT 0` column to `tasks` (migration v5). Extend `TasksRepo` with `incrementProgress(id, delta)`. Have `InferenceEngine.runInferencePass` call it for each `progress_increment`; if the resulting value ≥ 100 the task is auto-marked `done` and a `task.completed` event fires (in addition to whatever the existing `entry.completed` branch does). Update `GoalsList` progress computation from `count(done)/count(all)` to `sum(task.progress)/(100*count)` so the bar moves smoothly.

**Tech Stack:** TypeScript strict, better-sqlite3, existing bus + repo patterns.

## Global Constraints

- **Migration monotonic.** Current max is v4 (`app/src/main/store/db.ts`). Next is v5.
- **Backfill:** existing `done` tasks get `progress = 100`; everything else `progress = 0` (the column default handles new rows).
- **Type safety:** update the `Task` interface in `app/src/shared/types.ts` (or wherever it lives) to include `progress: number`. `noUncheckedIndexedAccess` is on — use destructure + optional chaining in tests, not `!.`.
- **No comments** unless the WHY is non-obvious.
- **Tests:** TDD the migration, the repo method, the inference change. UI change can be verified by visual inspection.
- **Path-based pnpm filter.** `pnpm --filter ./app run <script>`.
- **pnpm at `/Users/liyu.xiao/Library/pnpm/pnpm`** — prepend that to PATH before running pnpm.

## File Structure

```
app/src/main/store/
├── db.ts                        (modify: add migration v5 block)
└── repos/
    └── tasks.ts                 (modify: extend interface + row mapper + new incrementProgress method)

app/src/main/activity/
└── inference.ts                 (modify: call incrementProgress, auto-complete at >=100)

app/src/renderer/main/pages/
└── GoalsList.tsx                (modify: use mean(progress) instead of count(done)/count(all))

app/src/shared/
└── types.ts                     (modify: add progress: number to Task type — check existing location)

app/tests/store/
├── migrations-v5.test.ts        (NEW: verify migration adds column, backfills done tasks to 100)
└── tasks-repo.test.ts           (modify: add tests for incrementProgress)

app/tests/main/
└── inference.test.ts            (modify OR NEW: verify accumulation + auto-complete at 100)
```

---

## Task 1: Migration v5 + Task type extension

**Files:**
- Modify: `app/src/main/store/db.ts` (add migration block at v5)
- Modify: `app/src/shared/types.ts` (add `progress: number` to `Task`)
- Create: `app/tests/store/migrations-v5.test.ts`

- [ ] **Step 1: Write the migration test**

Create `app/tests/store/migrations-v5.test.ts`. Model it after the existing v4 test (`app/tests/store/migrations-v4.test.ts`) — same shape:
- Set up an in-memory DB at v4 by running migrations then rolling back to `user_version = 4`. Simpler: run all migrations up to v4 via a helper that stops at 4, or just insert into a raw v4 shape.
- Insert a goal + two tasks (one `status = 'done'`, one `status = 'todo'`).
- Bump to v5 by running `runMigrations` again.
- Assert: `progress` column exists; the `done` task has `progress = 100`; the `todo` task has `progress = 0`; `user_version` is now 5.

- [ ] **Step 2: Run to verify FAIL**

```bash
export PATH=/Users/liyu.xiao/Library/pnpm/pnpm:$PATH
pnpm --filter ./app exec vitest run tests/store/migrations-v5.test.ts
```
Expected: FAIL (v5 migration not present, so `progress` column doesn't exist).

- [ ] **Step 3: Add the migration**

Add to the `MIGRATIONS` array in `app/src/main/store/db.ts`, after the v4 entry:

```ts
{
  version: 5,
  up: (db) => {
    db.exec(`ALTER TABLE tasks ADD COLUMN progress REAL NOT NULL DEFAULT 0`);
    db.exec(`UPDATE tasks SET progress = 100 WHERE status = 'done'`);
  },
},
```

(Match the exact structure of the existing v4 entry — same object literal shape.)

- [ ] **Step 4: Extend Task type**

Find the `Task` interface. Likely in `app/src/shared/types.ts`. Add:
```ts
export interface Task {
  // …existing fields
  progress: number;
}
```

- [ ] **Step 5: Run test to verify PASS**

```bash
pnpm --filter ./app exec vitest run tests/store/migrations-v5.test.ts
```
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/store/db.ts app/src/shared/types.ts app/tests/store/migrations-v5.test.ts
git commit -m "feat(store): add tasks.progress column (migration v5)"
```

---

## Task 2: TasksRepo — read + write progress

**Files:**
- Modify: `app/src/main/store/repos/tasks.ts` (update row mapper to include `progress`; add `incrementProgress` method)
- Modify: `app/tests/store/tasks-repo.test.ts` (add tests for `incrementProgress`)

**Interfaces:**
- Produces: `TasksRepo.incrementProgress(id: string, delta: number): Task` — clamps final value to [0, 100], returns updated Task.

- [ ] **Step 1: Update the row mapper**

Every `map*` helper in `tasks.ts` that turns a SQLite row into `Task` needs to read `progress`. Add to each row mapper:
```ts
progress: row.progress as number,
```
And add `progress` to every row shape type declaration in the file (search for `row: { ...`).

Also update the SQL `SELECT` lists to include `progress`:
```ts
`SELECT id, goal_id, ..., progress FROM tasks WHERE …`
```
(Check each of the prepared statements: `insertStmt`, `updateStmt`, `listByGoalStmt`, `listStmt`, `getStmt`, etc.)

For `create()`, no change needed — the default `0` handles it.

- [ ] **Step 2: Write the incrementProgress test**

Add to `app/tests/store/tasks-repo.test.ts`:

```ts
it('incrementProgress adds delta and returns updated task', () => {
  const goal = GoalsRepo.create({ title: 'g', ... });
  const task = TasksRepo.create({ goalId: goal.id, title: 't', estimateMinutes: 30, status: 'todo' });
  const updated = TasksRepo.incrementProgress(task.id, 25);
  expect(updated.progress).toBe(25);
  const again = TasksRepo.incrementProgress(task.id, 30);
  expect(again.progress).toBe(55);
});

it('incrementProgress clamps to [0, 100]', () => {
  const task = TasksRepo.create({ ... });
  TasksRepo.incrementProgress(task.id, 90);
  const clamped = TasksRepo.incrementProgress(task.id, 30);
  expect(clamped.progress).toBe(100);
});
```

- [ ] **Step 3: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/store/tasks-repo.test.ts
```
Expected: FAIL — `incrementProgress` doesn't exist.

- [ ] **Step 4: Implement incrementProgress**

Add to `TasksRepo` (near `update`):
```ts
const incrementProgressStmt = db.prepare(`
  UPDATE tasks
  SET progress = MAX(0, MIN(100, progress + ?)),
      updated_at = ?
  WHERE id = ?
`);

incrementProgress(id: string, delta: number): Task {
  const now = new Date().toISOString();
  const info = incrementProgressStmt.run(delta, now, id);
  if (info.changes === 0) throw new Error(`Task not found: ${id}`);
  const row = getStmt.get(id) as TaskRow;
  return mapTask(row);
}
```

(Match the naming conventions from the existing methods in the file — use `db.prepare` if that's the pattern, or module-level constants.)

- [ ] **Step 5: Verify tests PASS**

```bash
pnpm --filter ./app exec vitest run tests/store/tasks-repo.test.ts
```
Expected: green.

- [ ] **Step 6: Full suite still green**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 7: Commit**

```bash
git add app/src/main/store/repos/tasks.ts app/tests/store/tasks-repo.test.ts
git commit -m "feat(store): add TasksRepo.incrementProgress"
```

---

## Task 3: InferenceEngine — accumulate + auto-complete

**Files:**
- Modify: `app/src/main/activity/inference.ts`
- Modify: `app/tests/main/inference.test.ts` (or wherever InferenceEngine tests live — check `find app/tests -name "inference*"`)

- [ ] **Step 1: Write the test**

Add or update a test that verifies:
- Given a task with `progress = 80` and inference returns `progress_increment: 25` (`completed: false`), after `runInferencePass` the task has `progress = 100`, `status = 'done'`, and a `task.completed` event was emitted.
- Given a task with `progress = 30` and inference returns `progress_increment: 20`, after the pass the task has `progress = 50`, `status = 'todo'` (unchanged), and NO `task.completed` event.
- `entry.completed: true` still short-circuits to `status = 'done'` even if progress hasn't hit 100.

Mock the backend `fetch` for `/api/infer-progress` to return the canned payload.

- [ ] **Step 2: Run to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/main/inference.test.ts
```
(Or the actual path — `find app/tests -name "inference*"`.)

- [ ] **Step 3: Update the loop in `runInferencePass`**

Change this block in `app/src/main/activity/inference.ts` (currently lines 97–111):

```ts
const validIds = new Set(activeTasks.map((t) => t.id));
for (const entry of payload.task_progress) {
  if (!validIds.has(entry.taskId)) continue;

  const increment = entry.progress_increment ?? 0;
  const updated = this.tasksRepo.incrementProgress(entry.taskId, increment);

  const shouldComplete = entry.completed || updated.progress >= 100;
  if (shouldComplete && updated.status !== 'done') {
    const done = this.tasksRepo.update(entry.taskId, { status: 'done' });
    this.bus.emit('task.completed', done);
  }

  const inserted = this.summariesRepo.insert({
    taskId: entry.taskId,
    summary: entry.reasoning,
    signal: Math.min(1, Math.max(0, increment / 100)),
    ts: nowTs,
  });
  this.bus.emit('summary.created', inserted);
}
```

- [ ] **Step 4: Verify tests PASS**

```bash
pnpm --filter ./app exec vitest run tests/main/inference.test.ts
```
Expected: green.

- [ ] **Step 5: Full suite green**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 6: Commit**

```bash
git add app/src/main/activity/inference.ts app/tests/main/inference.test.ts
git commit -m "feat(inference): accumulate progress_increment; auto-complete at 100"
```

---

## Task 4: GoalsList — smooth progress bar

**Files:**
- Modify: `app/src/renderer/main/pages/GoalsList.tsx`

- [ ] **Step 1: Change the progressValue computation**

Around line 216 in `GoalsList.tsx`, replace:
```ts
const doneTasks = goalTasks.filter((t) => t.status === 'done');
const progressValue =
  goalTasks.length > 0 ? doneTasks.length / goalTasks.length : 0;
```
with:
```ts
const progressValue =
  goalTasks.length > 0
    ? goalTasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / (goalTasks.length * 100)
    : 0;
```

(The `?? 0` keeps rendering safe if a stale local cache lacks the field.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter ./app run typecheck
```

- [ ] **Step 3: Manual verification**

Not testable via `pnpm test` (renderer visual). Verification is: launch `pnpm dev`, plan a goal with 4 tasks, and confirm the goal's progress bar shows partial fill after a mock inference pass. Since CI-level tests can't drive Electron on this box (see CLAUDE.md 2026-07-17 lesson), just document the manual test in the commit and let the user visually verify.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/main/pages/GoalsList.tsx
git commit -m "feat(ui): goal progress bar reflects task-level progress"
```

---

## Task 5: Push + open PR

- [ ] **Step 1: Push the branch and open a PR**

```bash
git push -u origin task-progress-accumulation
gh pr create --title "feat: task progress accumulation + auto-complete at 100%" --body "$(cat <<'EOF'
## Summary
- Adds \`tasks.progress\` (REAL, 0-100) via migration v5; backfills \`done\` tasks to 100.
- \`TasksRepo.incrementProgress\` applies inference deltas with [0,100] clamp.
- InferenceEngine now accumulates \`progress_increment\` per pass and auto-flips a task to \`done\` when it hits 100 (existing \`completed: true\` short-circuit preserved).
- GoalsList progress bar changes from \`count(done)/count(all)\` to \`mean(task.progress)\` so the bar moves smoothly with each +X% timeline entry.

## Test plan
- [x] \`pnpm --filter ./app typecheck\` clean
- [x] \`pnpm --filter ./app lint\` clean
- [x] \`pnpm --filter ./app test\` green (new migration-v5 test, tasks-repo incrementProgress tests, inference accumulation tests)
- [ ] Manual: goal progress bar visibly moves as timeline shows +X% Progress entries; a task with cumulative >=100 flips to done

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Report back with the PR URL**

## Self-Review Notes

1. **Spec coverage:** All three symptoms in the user's report addressed — bar advances (Task 4), task auto-completes (Task 3 accumulation branch), subtasks get checked off (Task 3 both branches).
2. **Placeholder scan:** Every step has concrete code. Test cases are named with the actual assertion.
3. **Type consistency:** `progress` is `number` in TS, `REAL` in SQLite, unit is `0..100` throughout — no ratio (0..1) mixing except the existing `summaries.signal` field, which stays as-is (it's just a display fraction).

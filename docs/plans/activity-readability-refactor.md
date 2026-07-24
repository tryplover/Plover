# Activity module readability + light-dedup refactor

## Context

`app/src/main/activity/` has 8 files, 845 LOC. When reading through them
top-down, three problems are obvious:

1. **Fragmented flow.** Several functions do 4–7 unrelated things in a
   single body (`git-commit-tracker.handleCommitEvent` is 44 lines /
   7 concerns; `screen-capturer.captureOnce` and
   `window-tracker.checkActiveWindow` are similar).
2. **Inverted or missing top-down trace.** Some files' entry points are
   fine, but the multi-concern methods above mean the "one flow" you'd
   expect the top of the file to show is instead scattered inline.
3. **Real duplication** in two places: (a) the `pauseAllTracking || !flag`
   settings-gate pattern (5 call sites), (b) the "queue promise onto a
   serialized chain" idiom (4 call sites across folder-watcher and
   git-commit-tracker).

There is **also** a load-bearing concern the user surfaced: the
`GitCommitTracker` class currently welds "detect commit" and "match
commit → mark task done + notify" into one class. The user chose (via
AskUserQuestion) to fully separate these into two classes.

The intended outcome: after this refactor, each file in `activity/` reads
depth-first from its exported entry point down through single-purpose
helpers, shared idioms live in `activity/shared/`, and the
commit→task-completion concern lives in its own file. No behavior
changes, no new features, no DB migrations. Tests stay green.

This refactor is **complementary to** the existing
`docs/plans/activity-per-service-restructure.md` plan (which introduces
per-service subfolders `activity/google/`, `activity/github/`, etc.).
File paths and public APIs stay stable so that plan can still `git mv`
files cleanly afterward.

## Non-goals

- Per-service subfolders (`activity/local/`, `activity/google/`, …) — separate plan
- New integrations, event kinds, DB migrations, features
- Fixing the `throw` vs `return-silently` convention in `inference.ts` (already flagged elsewhere)
- Fixing the `activityRepo.insert({kind, payload})` vs `activityRepo.log(kind, payload)` inconsistency (flag only)
- No new deps, no `!` non-null assertions (ESLint bans them)

## Shared helpers to extract

Two, both under a new `app/src/main/activity/shared/` folder. Nothing else is
worth extracting (path-normalize, `.git/COMMIT_EDITMSG` recognition, "store
handler ref then clear in stop()" — all evaluated and rejected as false
abstractions).

**`activity/shared/gate.ts`** — collapses 5 sites:

```ts
export function gate(settingsRepo: SettingsRepo, featureKey: BoolKeyOf<AppSettings>): boolean {
  const s = settingsRepo.getAll();
  if (s.pauseAllTracking) return false;
  return Boolean(s[featureKey]);
}
```

Constrain `featureKey` to the boolean-typed keys of `AppSettings` via a
utility type so the compiler blocks misuse. Callers that need a *second*
flag (e.g. `windowTrackingEnabled + !pauseScheduling`) do the extra AND
inline — do not overload `gate()` with more flags.

**`activity/shared/serialize-async.ts`** — collapses 4 sites (the
`watchChain = watchChain.then(...).catch(...)` and `inflight` idioms):

```ts
export function serializeAsync(onError?: (err: unknown) => void) {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = tail.then(fn);
    tail = onError ? next.catch(onError) : next.catch(() => undefined);
    return next;
  };
}
```

Classes hold `private enqueue = serializeAsync(err => console.error('[X]', err))`.

## Per-file work

Order of attack: shared helpers first (pure additions), then smallest
files, largest last, ownership fix in a final commit.

### 1. `shared/gate.ts` (new, ~10 LOC)

Add the helper + `BoolKeyOf<T>` utility type. No callers yet.

### 2. `shared/serialize-async.ts` (new, ~15 LOC)

Add the helper. No callers yet.

### 3. `retention.ts` — no changes

Already two coherent phases (screenshot unlink, then bulk purge). Leave alone.

### 4. `gdocs-subscriber.ts` — tiny SRP split

Target:
```
export class GDocsActivitySubscriber {
  start(): void                  // registers handleRevision
  stop(): void                   // deregisters
  private handleRevision = (p: GDocsRevisionPayload): void
}
```
Extract the inline arrow into a stable `handleRevision` field so `off()`
gets the same reference. Adopt `gate(settingsRepo, 'gdocsPollingEnabled')`.
Keep `.log('gdocs_revision', …)` as-is (flag `log` vs `insert` inconsistency
in the commit body, don't fix).

### 5. `window-tracker.ts` — SRP split

Target order top-down:
```
export class WindowTracker {
  start(): void
  stop(): void
  checkActiveWindow(): Promise<void>        // orchestrator, ~15 LOC
  private canRun(): boolean                  // platform + permission + gate + reentrancy check
  private getActiveWindowFromOS(): Promise<WindowMeta>
  private tryReadBrowserTab(app): Promise<{url;title}|null>
  private diffAndRecord(meta): void          // owns lastApp/lastTitle/lastLogTime
  private buildPayload(meta): Record<string, unknown>
}
```

Preserve exact reentrancy semantics — set `isChecking = true` inside
`checkActiveWindow` after `canRun()` returns true, clear in `finally`. Do NOT
put the mutation inside `canRun` (would change semantics under exceptions).
Adopt `gate(settingsRepo, 'windowTrackingEnabled')`; keep `!pauseScheduling`
inline as the extra AND. Keep `BROWSER_BUNDLES` at module top (data, not helper).

### 6. `screen-capturer.ts` — SRP split

Target:
```
export class ScreenCapturer {
  start(): void
  stop(): void
  captureOnce(): Promise<string | null>            // gate → grab → persist → maybeInfer
  private canCapture(): boolean                     // gate + permission
  private grabPrimaryScreen(): Promise<{png; size} | null>
  private persistScreenshot(png, size): Promise<{filePath; row}>
  private maybeRunInference(row, filePath, png): Promise<void>
  private runInference(id, filePath, png): Promise<void>
  private scheduleNext(): void
}
```

Fold the two `setTimeout` sites in `start()` and `captureOnce()` into
`scheduleNext()`. Adopt `gate(settingsRepo, 'screenCaptureEnabled')`.
Keep `insert` for `screenshot_captured` and `log` for
`screenshot_inferred` (behavior-preserving).

### 7. `folder-watcher.ts` — collapse dup + extract ignore predicate

Target:
```
export class FolderWatcher {
  watch(paths): Promise<void>                       // this.enqueue(() => this.internalWatch(...))
  unwatch(paths): Promise<void>
  closeAllWatchers(): Promise<void>
  private enqueue = serializeAsync(err => console.error('[FolderWatcher]', err))
  private internalWatch(paths): Promise<void>
  private internalUnwatch(paths): Promise<void>
  private internalClose(): Promise<void>
  private handleFileEvent(kind, busChannel, path): void  // collapses handleFileAdd + handleFileChange
  private determineKind(filePath): 'md'|'git_commit_editmsg'|'other'
}
```

Extract the big inline chokidar `ignored` predicate into a
module-level pure function `shouldIgnoreForFolderWatch(path): boolean`
(so it's independently readable and unit-testable). Collapse
`handleFileChange` / `handleFileAdd` (near-duplicates differing only
in event kind + bus channel) into `handleFileEvent(kind, channel, path)`.
Adopt `gate(settingsRepo, 'fileWatchingEnabled')` inside
`handleFileEvent`. Do NOT extract path-normalize or
`.git/COMMIT_EDITMSG` string across files — three sites, three different
downstream semantics (ignore-allowlist vs kind-tag vs repo-path-strip);
cross-file dedup here would be false abstraction.

### 8. `git-commit-tracker.ts` — split into TWO classes

**Per user directive: fully separate commit detection from task
completion.** Not just an internal split.

**`git-commit-tracker.ts` becomes:**
```
export class GitCommitTracker {
  start(): void                          // subscribes onFileEvent to both folder.file_changed + folder.file_added
  stop(): void
  private onFileEvent = (payload) => void
  private enqueue = serializeAsync(err => console.error('[GitCommitTracker]', err))
  private handleCommitEvent(filePath): Promise<void>  // orchestrator ~10 LOC
  private resolveCommit(filePath): Promise<GitCommitInfo | null>  // extractRepoPath + readLatestCommit
  private markSeen(hash): boolean                                  // dedupe + LRU
  private recordCommit(commit): void                               // activityRepo.insert('git_commit', ...) + eventBus.emit('activity.git_commit', commit)
  private readLatestCommit(repoPath): Promise<GitCommitInfo | null>
}
```
No more `TasksRepo` dependency. No matcher. No notify. `recordCommit`
now also emits a new bus event `activity.git_commit` carrying the
`GitCommitInfo` payload.

**New file `commit-task-matcher.ts`:**
```
export type CommitMatcher = (commit, tasks) => Promise<MatchCommitResponse>
export class CommitTaskMatcher {
  constructor(tasksRepo, bus, matchCommit?: CommitMatcher, notify?: (title, body) => void)
  start(): void                          // subscribes onCommitLogged to 'activity.git_commit'
  stop(): void
  private onCommitLogged = (commit) => void
  private handleCommit(commit): Promise<void>  // list active tasks → matchCommit → mark done → emit 'task.completed' → notify
}
```
Owns `defaultMatchCommit` (the LLM call to `/api/match-commit`) and
`defaultNotify` (both currently in `git-commit-tracker.ts`, move over).

**Bus schema change:** add `'activity.git_commit'` event with payload
`GitCommitInfo` to `event-bus.ts` typed channel list. Preserve existing
`task.completed` emit — that stays in the matcher.

**Test migration:**
- `app/tests/activity/git-commit-tracker.test.ts` — remove assertions
  about task completion / notification (which are now the matcher's job).
  Keep dedupe, activity-write, and new "emits activity.git_commit" tests.
- `app/tests/activity/git-commit-tracker-notify.test.ts` — move to
  `commit-task-matcher-notify.test.ts` (new file). Assertions unchanged
  in intent — matcher now owns notify.
- `app/tests/activity/git-commit-tracker-security.test.ts` — stays as-is
  (argv-injection guard is still inside `readLatestCommit`).
- New `app/tests/activity/commit-task-matcher.test.ts` — verifies
  subscribing → match → mark done → emit → notify.

Reuse `defaultMatchCommit` and `defaultNotify` verbatim — just move the
functions to the new file.

### 9. `inference.ts` — split `runInferencePass`

Target:
```
export class InferenceEngine {
  start(): void
  stop(): void
  runInferencePass(): Promise<void>                                    // orchestrator, ~15 LOC
  private collectInputs(lastTs): { activeTasks, activity }
  private fetchInference(activeTasks, activity): Promise<InferProgressResponse | null>
  private applyProgress(entries, activeTasks, nowTs): void
}
```

Preserve the mixed error semantics **exactly**: `UnauthorizedError`
propagates from `fetchInference` and thus from `runInferencePass`; all
other errors are logged inside `fetchInference` and returned as `null`.
User explicitly said this is out of scope for this pass.

### 10. `activity/index.ts` — ownership consolidation (final commit)

Currently split arbitrarily: `main/index.ts` owns `FolderWatcher`,
`InferenceEngine`, `GitCommitTracker`; `activity/index.ts` owns
`WindowTracker`, `GDocsActivitySubscriber`, `ScreenCapturer`, retention.
No non-activity code reads any of the six trackers, so the split has no
justification.

**Move all six trackers + the new `CommitTaskMatcher` into
`initActivityMonitoring` / `stopActivityMonitoring`.**

Changes in `app/src/main/index.ts`:
- Delete `let folderWatcher | inferenceEngine | gitCommitTracker` module locals + imports.
- Replace the three `if (…) start()` blocks in `app.whenReady` with `await initActivityMonitoring()` (single await).
- In `will-quit` (and `before-quit` — see risk below), call `stopActivityMonitoring()` once.

Changes in `app/src/main/activity/index.ts`:
- Add module locals for `folderWatcher | inferenceEngine | gitCommitTracker | commitTaskMatcher`.
- Import `tasksRepo`, `summariesRepo` from `../store/index.js` (needed by inference + matcher).
- `initActivityMonitoring` becomes `async` (single call site, cheap change) — inside it, instantiate `FolderWatcher`, read `settings.watchedFolders`, `await folderWatcher.watch(...)` when non-empty; instantiate + `start()` inference, git-commit-tracker, and commit-task-matcher.
- `stopActivityMonitoring` calls `stop()` / `closeAllWatchers()` on all six.

## Verification

From repo root:

```
export PATH=$HOME/Library/pnpm:$PATH
pnpm --filter ./app run typecheck
pnpm --filter ./app run lint
pnpm --filter ./app run test
```

Green means: zero TS errors under strict/`noUncheckedIndexedAccess`/`noImplicitOverride`,
zero ESLint errors, all existing tests pass. The 8 pre-existing renderer
localStorage failures on `main` remain unchanged (they are unrelated to
this work — confirmed via stash-and-rerun in the prior try/catch PR).

End-to-end smoke (manual, at user's discretion):
- `pnpm dev` launches Electron.
- Add a watched folder in Settings → save → touch a `.md` file → confirm
  activity row appears (folder-watcher still works).
- Make a git commit inside a watched folder → confirm `git_commit`
  activity row exists AND the task-completion side still fires (matcher
  wired correctly).
- Wait 30 min or force an inference pass → confirm progress updates.

## Suggested commit sequence

Each commit typechecks + lints + tests green in isolation:

1. `refactor(activity/shared): add gate helper`
2. `refactor(activity/shared): add serializeAsync helper`
3. `refactor(activity/gdocs): extract handler ref, adopt gate()`
4. `refactor(activity/window-tracker): split checkActiveWindow into canRun/diff/buildPayload`
5. `refactor(activity/screen-capturer): split captureOnce; adopt gate/scheduleNext`
6. `refactor(activity/folder-watcher): collapse handleFile*, extract shouldIgnoreForFolderWatch, adopt serializeAsync + gate`
7. `refactor(activity/inference): split runInferencePass into collectInputs/fetchInference/applyProgress`
8. `refactor(activity): split GitCommitTracker into detector + CommitTaskMatcher; add activity.git_commit bus event`
9. `refactor(activity): consolidate all tracker ownership under initActivityMonitoring`

Steps 1–2 are pure additions. Step 8 is the biggest single commit (new
file + bus event + test migration) — reviewer sees the split cleanly. Step
9 lands last because it moves imports across modules.

## Critical files (existing, will be modified)

- `app/src/main/activity/index.ts`
- `app/src/main/activity/folder-watcher.ts`
- `app/src/main/activity/gdocs-subscriber.ts`
- `app/src/main/activity/git-commit-tracker.ts`
- `app/src/main/activity/inference.ts`
- `app/src/main/activity/screen-capturer.ts`
- `app/src/main/activity/window-tracker.ts`
- `app/src/main/index.ts`
- `app/src/main/event-bus.ts` (add `activity.git_commit` channel type)
- Existing test files under `app/tests/activity/` (per §8)

## New files

- `app/src/main/activity/shared/gate.ts`
- `app/src/main/activity/shared/serialize-async.ts`
- `app/src/main/activity/commit-task-matcher.ts`
- `app/tests/activity/commit-task-matcher.test.ts`
- `app/tests/activity/commit-task-matcher-notify.test.ts` (moved from git-commit-tracker-notify.test.ts)

## Reused existing utilities

- `SettingsRepo` (in `app/src/main/store/repos/settings.ts`) — consumed by `gate()`
- `TypedEventBus` (in `app/src/main/event-bus.ts`) — consumed by every source and the new matcher
- `ActivityRepo.insert` / `ActivityRepo.log` (in `app/src/main/store/repos/activity.ts`) — unchanged
- Existing `defaultMatchCommit` and `defaultNotify` functions — moved from `git-commit-tracker.ts` to `commit-task-matcher.ts` verbatim

## Risks / open items (resolved-with-defaults, flag if user disagrees)

- **Activity startup ordering:** `initActivityMonitoring` becomes `async` so that `folderWatcher.watch(...)` still completes before UI opens. One call site in `main/index.ts` — cheap.
- **Quit lifecycle:** Currently `folderWatcher.closeAllWatchers()` fires in `before-quit` (fire-and-forget) and other stops fire in `will-quit`. Post-refactor: call `stopActivityMonitoring()` once from `will-quit`. The behavior difference (folder-watcher no longer stops fractionally earlier) is invisible — chokidar close is idempotent and quick. If a reviewer flags this, add an idempotent call from `before-quit` too.
- **`GitCommitTracker` public API:** the constructor signature changes (no more `tasksRepo`, `matchCommit`, `notify` params). This is a breaking change to the class's own callers, but the only callers are `main/index.ts` (removed in step 9) and the tests (rewritten in step 8). Not a repo-wide breakage.
- **`activity.git_commit` bus event** is a new channel. Add to `TypedEventBus`'s type map. No existing subscriber — safe.

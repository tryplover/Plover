# Freeze Local Activity Collection at Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the local activity collectors (window tracker, folder watcher, git commit tracker) from running in the desktop-buddy pivot, including for profiles whose old saved settings have tracking enabled and folders watched. Keep the source code, activity storage, and retention.

**Architecture:** `initActivityMonitoring()` in `app/src/main/activity/index.ts` is the only place these three collectors are constructed and started (verified by grep: no IPC or settings handler starts them). Removing that wiring and its stop branches is the whole runtime change. The lifecycle test added by the previous PR (#415) is extended to pin it.

**Tech Stack:** TypeScript (strict), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5 non-goals: no screen capture, window-title logging, or keystroke counting; §6 activity monitoring frozen). Source of this scope: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 4, "Freeze remaining local activity collection, preserving retention and source code".

**Stacking:** this branch is stacked on `chore/stop-screen-capture` (PR #415), which edits the same function and test file. Its PR base is that branch.

## Global Constraints

- One small purpose per PR: this PR only freezes the three local collectors.
- Preserve, do not delete: `app/src/main/activity/sources/system/window-tracker/**`, `.../folder-watcher/**`, `app/src/main/activity/sources/git/**`, their tests (`window-tracker.test.ts`, `folder-watcher.test.ts`, `git-commit-tracker*.test.ts`), the activity table and repo, the retention job, and the related settings keys (`windowTrackingEnabled`, `fileWatchingEnabled`, `watchedFolders`, `pauseAllTracking`).
- Leave running (separate decisions): the activity bus subscribers for Google/GitHub connector events (queue item 5 handles the pollers), the inference engine and commit task matcher (the founder closed the retirement stack #408 to #410 "not pursuing right now"; do not touch them), retention.
- Not in this PR: the `window:list-active` IPC and setup-flow window picker (queue item 8), Settings and onboarding UI, connector pollers, backend routes.
- TypeScript strict; no comments unless the WHY is non-obvious; no new deps.
- pnpm via the global binary: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file tests: `pnpm --filter ./app exec vitest run <path>`. Final gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Lint note from the previous PR: `@typescript-eslint/no-empty-function` rejects empty method bodies in test stub classes; use expression-bodied class fields (`start = () => undefined;`) with real `class` bodies (Vitest 4 mocks need real classes, not `vi.fn(() => ...)` with `new`). See the `plover-testing` skill.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commits are SSH-signed through 1Password; on "failed to fill whole buffer" retry the same commit, never pass `--no-gpg-sign`.

## Review Focus

- A profile with old flags `windowTrackingEnabled` and `fileWatchingEnabled` true and a non-empty `watchedFolders` must not construct or start the window tracker, folder watcher, or git commit tracker. Pinned in Task 1, with `process.platform` stubbed to `darwin` (the old code constructed the window tracker only on darwin and win32 and CI runs Ubuntu; the folder watcher and git tracker were unconditional).
- The test must prove `initActivityMonitoring` actually ran, with a positive control that survives this change: the retention job (`runRetention`) still runs on every init, per the sweep ("retention continues for existing data"). The previous PR used the window tracker as its control, which this PR removes, so that assertion must move.
- Repeated init does not start anything and still runs retention; `stopActivityMonitoring` still works with the remaining subsystems.
- Unused imports and variables left behind fail lint.

---

### Task 1: Remove the three collectors from the lifecycle and extend the test

**Files:**
- Modify: `app/src/main/activity/index.ts`
- Modify (full replacement): `app/tests/activity/activity-lifecycle.test.ts`

**Interfaces:**
- Consumes: `initActivityMonitoring()` / `stopActivityMonitoring()` from `@main/activity/index.js`; `settingsRepo` from `@main/store/index.js`.
- Produces: no new exports. Behaviour: `initActivityMonitoring()` constructs no `WindowTracker`, `FolderWatcher`, `GitCommitTracker` (and still no `ScreenCapturer`).

- [ ] **Step 1: Write the failing test**

Replace `app/tests/activity/activity-lifecycle.test.ts` entirely with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({
  screenCapturer: 0,
  windowTracker: 0,
  folderWatcher: 0,
  gitCommitTracker: 0,
  retentionRuns: 0,
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp/plover-lifecycle-test') } }));

vi.mock('@main/activity/sources/system/screen-capturer/index.js', () => ({
  ScreenCapturer: class {
    constructor() {
      constructed.screenCapturer += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/system/window-tracker/index.js', () => ({
  WindowTracker: class {
    constructor() {
      constructed.windowTracker += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/system/folder-watcher/index.js', () => ({
  FolderWatcher: class {
    constructor() {
      constructed.folderWatcher += 1;
    }
    watch = async () => undefined;
    closeAllWatchers = async () => undefined;
  },
}));

vi.mock('@main/activity/sources/git/git-commit-tracker/index.js', () => ({
  GitCommitTracker: class {
    constructor() {
      constructed.gitCommitTracker += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/sources/activity-subscriber.js', () => ({
  createActivitySubscribers: () => ({ start: () => undefined, stop: () => undefined }),
}));

vi.mock('@main/activity/processing/inference/index.js', () => ({
  InferenceEngine: class {
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/processing/commit-task-matcher/index.js', () => ({
  CommitTaskMatcher: class {
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/activity/processing/retention/index.js', () => ({
  runRetention: async () => {
    constructed.retentionRuns += 1;
  },
}));

import { settingsRepo } from '@main/store/index.js';
import { initActivityMonitoring, stopActivityMonitoring } from '@main/activity/index.js';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

function enableLegacyTracking() {
  settingsRepo.update({
    screenCaptureEnabled: true,
    screenVisionInferenceEnabled: true,
    windowTrackingEnabled: true,
    fileWatchingEnabled: true,
    pauseAllTracking: false,
    watchedFolders: ['/tmp/plover-lifecycle-watched'],
  });
}

describe('activity monitoring lifecycle', () => {
  beforeEach(() => {
    constructed.screenCapturer = 0;
    constructed.windowTracker = 0;
    constructed.folderWatcher = 0;
    constructed.gitCommitTracker = 0;
    constructed.retentionRuns = 0;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopActivityMonitoring();
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    vi.restoreAllMocks();
  });

  it('never starts screen capture, even with legacy capture and vision flags enabled', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });

  it('starts no local collectors, even with legacy tracking flags and watched folders', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(1);
    expect(constructed.windowTracker).toBe(0);
    expect(constructed.folderWatcher).toBe(0);
    expect(constructed.gitCommitTracker).toBe(0);
  });

  it('stays frozen on repeated init while retention keeps running', async () => {
    enableLegacyTracking();

    await initActivityMonitoring();
    await initActivityMonitoring();

    expect(constructed.retentionRuns).toBe(2);
    expect(constructed.screenCapturer).toBe(0);
    expect(constructed.windowTracker).toBe(0);
    expect(constructed.folderWatcher).toBe(0);
    expect(constructed.gitCommitTracker).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/activity/activity-lifecycle.test.ts`
Expected: the two collector tests FAIL (`expected 1 to be +0` on `windowTracker`, `folderWatcher`, or `gitCommitTracker`); the screen-capture test and the retention assertions pass. If the file fails to load, fix only the test scaffolding until the failure is the collector assertion and report what you changed. If `pauseAllTracking` or another key in `enableLegacyTracking` is not accepted by `settingsRepo.update`, drop only that key and report it.

- [ ] **Step 3: Remove the wiring**

In `app/src/main/activity/index.ts`:

- delete the imports of `WindowTracker`, `FolderWatcher`, `GitCommitTracker`
- delete the variables `windowTracker`, `folderWatcher`, `gitCommitTracker`
- delete from `initActivityMonitoring` the `if (process.platform === 'darwin' || process.platform === 'win32') { ... } else { console.log('[Activity] Window tracking is only supported ...') }` block, the `if (!folderWatcher) { ... }` block, and the `if (!gitCommitTracker) { ... }` block
- delete from `stopActivityMonitoring` the `folderWatcher`, `gitCommitTracker`, and `windowTracker` branches
- extend the existing WHY comment (currently about screen capture and Vision) so it reads:

```ts
  // The buddy pivot starts no screen capture, Vision, window, folder, or git collection, even for
  // profiles that saved the old flags. Those sources are kept for possible opt-in reuse; wire them
  // back here deliberately. Retention keeps trimming existing activity data.
```

Keep the bus subscribers, inference engine, commit task matcher, and retention exactly as they are. Do not touch the `sources/**` directories, their tests, the settings, the `window:list-active` IPC, the Settings or onboarding UI.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/activity`
Expected: PASS, including the unchanged `window-tracker`, `folder-watcher`, `git-commit-tracker*`, and `screen-capturer` test files, and the new lifecycle test with pristine output.

- [ ] **Step 5: Full gate and commit**

Run from repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (the test run takes 3-4 minutes; use a long timeout). Expected: all exit 0.

```bash
git add app/src/main/activity/index.ts app/tests/activity/activity-lifecycle.test.ts
git commit -m "fix(activity): stop starting window, folder, and git collectors at runtime

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: pivot spec §5 and §6 (activity monitoring frozen) and sweep queue item 4 (effective runtime freeze for fresh and migrated profiles, retain sources, storage, and retention) are covered by the flags-and-folders-enabled test, the preserved `sources/**` and tests, and the retention positive control.
- Placeholder scan: none.
- Known follow-ups (not this PR): connector pollers and activity bus subscribers (queue item 5), `window:list-active` and the setup-flow window picker (item 8), Settings and onboarding tracking UI (items 7 and 11), inference engine and commit matcher (closed stack #408 to #410, founder decision), backend routes.

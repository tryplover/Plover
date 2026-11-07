# Stop Screen Capture and Vision at Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the screen-capture and Gemini Vision pipeline from running in the desktop-buddy pivot, even when a user's old saved settings have capture and Vision enabled. Keep the `ScreenCapturer` code and its tests for possible future reuse.

**Architecture:** `initActivityMonitoring()` in `app/src/main/activity/index.ts` is the single place `ScreenCapturer` is constructed and started. Removing that wiring (and its stop branch) is the whole runtime change. A new lifecycle test pins the behaviour at that boundary.

**Tech Stack:** TypeScript (strict), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5 non-goal "No screen capture, window-title logging or keystroke counting"; §6 activity monitoring is frozen). Source of this scope: `reports/pivot-removal-sweep-2026-10-10.md`, "Remove from active behavior" row 1 and the recommended next cleanup.

## Global Constraints

- One small purpose per PR (sweep conversation constraint). This PR only stops capture and Vision at runtime.
- Preserve, do not delete: `app/src/main/activity/sources/system/screen-capturer/**`, its test `app/tests/activity/screen-capturer.test.ts`, the `screenCaptureEnabled` / `screenVisionInferenceEnabled` / `screenCaptureIntervalMinutes` settings, the `/api/infer-screen` backend route, and the screen-recording permission module.
- Not in this PR (separate queue items): the Settings toggles and onboarding permission step (sweep items 7 and 11, they remain until their own PRs), window/file/commit collectors, connector pollers, inference engine and commit matcher, backend routes.
- TypeScript strict; no comments unless the WHY is non-obvious; no new deps. Frozen modules: this change only removes wiring from `activity/index.ts`.
- pnpm via the global binary: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file tests: `pnpm --filter ./app exec vitest run <path>`. Final gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commits are SSH-signed through 1Password; on "failed to fill whole buffer" retry the same commit, never pass `--no-gpg-sign`.

## Review Focus

- A profile with old flags `screenCaptureEnabled` and `screenVisionInferenceEnabled` both true must not construct or start `ScreenCapturer` (so no `desktopCapturer.getSources`, no screenshot files, no `/api/infer-screen` request). Pinned in Task 1. The test stubs `process.platform` to `darwin`, because the old code only constructed the capturer on darwin and win32 and CI runs Ubuntu.
- The test must prove `initActivityMonitoring` actually ran (a positive control: the window tracker is constructed once), so it cannot pass because init silently bailed out.
- `stopActivityMonitoring` still works after the removal, and calling `initActivityMonitoring` twice does not double-start other subsystems (existing idempotence).
- Unused imports left behind (`app` from electron, `ScreenCapturer`) fail lint, so they must go.

---

### Task 1: Remove the ScreenCapturer wiring and pin it with a lifecycle test

**Files:**
- Modify: `app/src/main/activity/index.ts` (remove the `app` and `ScreenCapturer` imports, the `screenCapturer` variable, the construct-and-start block, and the stop branch; add one WHY comment)
- Create: `app/tests/activity/activity-lifecycle.test.ts`

**Interfaces:**
- Consumes: `initActivityMonitoring()` and `stopActivityMonitoring()` from `@main/activity/index.js`; `settingsRepo` from `@main/store/index.js` (in-memory DB under vitest).
- Produces: no new exports. Behaviour: `initActivityMonitoring()` never constructs `ScreenCapturer`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/activity/activity-lifecycle.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({ screenCapturer: 0, windowTracker: 0 }));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp/plover-lifecycle-test') } }));

vi.mock('@main/activity/sources/system/screen-capturer/index.js', () => ({
  ScreenCapturer: class {
    constructor() {
      constructed.screenCapturer += 1;
    }
    start() {}
    stop() {}
  },
}));

vi.mock('@main/activity/sources/system/window-tracker/index.js', () => ({
  WindowTracker: class {
    constructor() {
      constructed.windowTracker += 1;
    }
    start() {}
    stop() {}
  },
}));

vi.mock('@main/activity/sources/activity-subscriber.js', () => ({
  createActivitySubscribers: () => ({ start() {}, stop() {} }),
}));

vi.mock('@main/activity/sources/system/folder-watcher/index.js', () => ({
  FolderWatcher: class {
    async watch() {}
    async closeAllWatchers() {}
  },
}));

vi.mock('@main/activity/processing/inference/index.js', () => ({
  InferenceEngine: class {
    start() {}
    stop() {}
  },
}));

vi.mock('@main/activity/sources/git/git-commit-tracker/index.js', () => ({
  GitCommitTracker: class {
    start() {}
    stop() {}
  },
}));

vi.mock('@main/activity/processing/commit-task-matcher/index.js', () => ({
  CommitTaskMatcher: class {
    start() {}
    stop() {}
  },
}));

vi.mock('@main/activity/processing/retention/index.js', () => ({
  runRetention: async () => undefined,
}));

import { settingsRepo } from '@main/store/index.js';
import { initActivityMonitoring, stopActivityMonitoring } from '@main/activity/index.js';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

describe('activity monitoring lifecycle', () => {
  beforeEach(() => {
    constructed.screenCapturer = 0;
    constructed.windowTracker = 0;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopActivityMonitoring();
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    vi.restoreAllMocks();
  });

  it('never starts screen capture, even with legacy capture and vision flags enabled', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });

    await initActivityMonitoring();

    expect(constructed.windowTracker).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });

  it('does not construct a screen capturer on repeated init either', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });

    await initActivityMonitoring();
    await initActivityMonitoring();

    expect(constructed.windowTracker).toBe(1);
    expect(constructed.screenCapturer).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/activity/activity-lifecycle.test.ts`
Expected: FAIL, first test with `expected 1 to be +0` (the old code constructs the capturer on darwin). If the file fails to even load (an import or mock problem), fix only the test scaffolding until the failure is that assertion, and report what you changed.

- [ ] **Step 3: Remove the wiring**

In `app/src/main/activity/index.ts`:

- delete the line `import { app } from 'electron';`
- delete the line `import { ScreenCapturer } from './sources/system/screen-capturer/index.js';`
- delete the line `let screenCapturer: ScreenCapturer | null = null;`
- delete this block from `initActivityMonitoring`:

```ts
  if ((process.platform === 'darwin' || process.platform === 'win32') && !screenCapturer) {
    screenCapturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir: app.getPath('userData'),
    });
    screenCapturer.start();
  }
```

and put this comment in its place:

```ts
  // Screen capture and Vision stay off in the buddy pivot, even for profiles that saved the old
  // flags. ScreenCapturer is kept for possible opt-in reuse; wire it back here deliberately.
```

- delete this branch from `stopActivityMonitoring`:

```ts
  if (screenCapturer) {
    screenCapturer.stop();
    screenCapturer = null;
  }
```

Do not touch `screen-capturer/**`, `tests/activity/screen-capturer.test.ts`, settings, Settings UI, onboarding, or any other subsystem.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/activity`
Expected: PASS, including the unchanged `screen-capturer.test.ts` (the preserved module still passes its own tests) and the new lifecycle test with pristine output (no `[Activity]` log lines, since `console.log` is spied).

- [ ] **Step 5: Full gate and commit**

Run from repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (the test run takes 3-4 minutes; use a long timeout). Expected: all exit 0.

```bash
git add app/src/main/activity/index.ts app/tests/activity/activity-lifecycle.test.ts
git commit -m "fix(activity): stop starting screen capture and Vision at runtime

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: pivot spec §5 "no screen capture" and §6 frozen activity monitoring are enforced at the one lifecycle entry point; sweep row 1 requirements ("still produce no capture, files, or `/api/infer-screen` requests" with old flags) are covered by the flags-enabled test; "preserve code for evaluation" is covered by leaving `screen-capturer/**` and its tests untouched.
- Placeholder scan: none.
- Known follow-ups (not this PR): Settings capture/Vision toggles and onboarding screen-permission step now control nothing and still prompt for the OS permission (sweep items 1, 7, 11); window/file/commit collectors, pollers, inference engine and commit matcher still start (sweep queue items 4, 5, #408/#409).

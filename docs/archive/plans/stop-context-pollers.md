# Stop Context Connector Pollers at Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Google Docs, Gmail, Calendar, Classroom, and GitHub pollers from starting when the app boots, including for users whose old saved credentials and settings had them connected. Keep the connector, auth, cursor storage, and poller code.

**Architecture:** `app/src/main/index.ts` constructs and starts every poller inline in the `app.whenReady()` callback (verified by grep: it is the only place `GDocsPoller` or `SourcePoller` are constructed outside their own directory). Removing that block and its stop code in `before-quit` is the whole runtime change. Because `main/index.ts` has no tests today, a new startup test boots it under a generic electron mock and asserts no poller is constructed.

**Tech Stack:** TypeScript (strict), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md` (§5 non-goals: no Gmail, Drive, Docs, Classroom or GitHub connectors; §6 connector sources frozen, calendar un-frozen later in roadmap M6). Source of this scope: `reports/pivot-removal-sweep-2026-10-10.md`, queue item 5 and the "Google/GitHub pollers" row: "Stop starting context pollers in the pivot. Loading old credentials and pausing collection are distinct concerns; retain auth/storage code until disconnect/migration behavior is decided."

**Stacking:** this branch is stacked on `chore/freeze-local-collection` (PR #416), which is stacked on `chore/stop-screen-capture` (PR #415). Its PR base is `chore/freeze-local-collection`. `main/index.ts` is touched by #416 (one comment line), so stacking avoids a conflict.

## Global Constraints

- One small purpose per PR: this PR only stops poller startup in `app/src/main/index.ts`.
- Preserve, do not delete: everything under `app/src/main/sync/**`, their tests, `googleAuth` / `githubAuth` and their IPC handlers, `syncCursors` and its repo, the activity bus subscribers (they are idle without events), settings keys, and credential restore in `setupIpcHandlers` (`loadSavedCredentials` in `app/src/main/ipc/index.ts`, which also restores Supabase auth; do not touch).
- Calendar is the one connector the MVP will bring back (roadmap M6). That wiring is a deliberate later change; do not keep Calendar polling alive "just in case".
- Not in this PR: Settings and onboarding connector UI, the `window:list-active` IPC, backend routes, the inference engine and commit matcher (the founder closed the retirement stack #408 to #410).
- TypeScript strict; no comments unless the WHY is non-obvious; no new deps.
- pnpm via the global binary: `export PATH=/Users/liyu.xiao/Library/pnpm:$PATH`. Per-file tests: `pnpm --filter ./app exec vitest run <path>`. Final gate from repo root: `pnpm typecheck && pnpm lint && pnpm test`.
- Lint notes from earlier PRs: `@typescript-eslint/no-empty-function` rejects empty method bodies in test stub classes (use expression-bodied class fields like `start = () => undefined;` with real `class` bodies); Vitest 4 mocks need real classes, not `vi.fn(() => ...)` with `new`. See the `plover-testing` skill.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commits are SSH-signed through 1Password; on "failed to fill whole buffer" retry the same commit, never pass `--no-gpg-sign`.

## Review Focus

- A profile that was connected to Google and GitHub (old settings and saved credentials) must cause no polling at boot: `GDocsPoller` and `SourcePoller` are never constructed. Pinned in Task 1 by booting `main/index.ts`.
- The test must prove startup actually ran to the point where pollers used to start, not silently bailed out: `initActivityMonitoring` is called once (positive control).
- Supabase sign-in restore still happens: it lives in `ipc/index.ts` (`setupIpcHandlers`), which this PR does not touch.
- `before-quit` still works with no pollers; unused imports (`GDocsPoller`, `SourcePoller`, the five source classes, `GitHubClient`, `googleAuth`, `githubAuth`, `syncCursors`, possibly `settingsRepo` and `eventBus`) fail lint and must go if unused.

---

### Task 1: Remove poller startup from `main/index.ts` and add a startup test

**Files:**
- Modify: `app/src/main/index.ts`
- Create: `app/tests/main/startup.test.ts`

**Interfaces:**
- Consumes: the module `@main/index.js` (its side effects run on import); mocks for `electron`, `@main/load-env.js`, `@main/ipc/index.js`, the poller and source modules, and `@main/activity/index.js`.
- Produces: no new exports. Behaviour: booting the app constructs no `GDocsPoller` or `SourcePoller`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/main/startup.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => ({
  gdocsPoller: 0,
  sourcePoller: 0,
  activityInits: 0,
}));

type Deep = ((...args: unknown[]) => Deep) & { [key: string]: Deep };

const deep = vi.hoisted(() => {
  const make = (overrides: Record<string, unknown> = {}): Deep =>
    new Proxy(function () {} as unknown as Deep, {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop in overrides) return overrides[prop];
        if (prop === 'then') return undefined;
        return make();
      },
      apply: () => make(),
    });
  return make;
});

vi.mock('electron', () => {
  class BrowserWindow {
    constructor() {
      return deep();
    }
    static getAllWindows() {
      return [];
    }
  }
  return {
    app: deep({
      isPackaged: false,
      requestSingleInstanceLock: () => true,
      whenReady: () => Promise.resolve(),
    }),
    BrowserWindow,
    globalShortcut: deep({ register: () => true }),
    nativeImage: deep(),
  };
});

vi.mock('@main/load-env.js', () => ({}));

vi.mock('@main/ipc/index.js', () => ({
  setupIpc: () => () => ({ show: () => undefined }),
  googleAuth: {},
  githubAuth: {},
}));

vi.mock('@main/sync/gdocs-poller.js', () => ({
  GDocsPoller: class {
    constructor() {
      constructed.gdocsPoller += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/sync/source-poller.js', () => ({
  SourcePoller: class {
    constructor() {
      constructed.sourcePoller += 1;
    }
    start = () => undefined;
    stop = () => undefined;
  },
}));

vi.mock('@main/sync/google/gmail-source.js', () => ({ GmailSource: class {} }));
vi.mock('@main/sync/google/calendar-source.js', () => ({ CalendarSource: class {} }));
vi.mock('@main/sync/google/classroom-source.js', () => ({ ClassroomSource: class {} }));
vi.mock('@main/sync/github/github-client.js', () => ({ GitHubClient: class {} }));
vi.mock('@main/sync/github/commits-source.js', () => ({ GitHubCommitsSource: class {} }));
vi.mock('@main/sync/github/prs-source.js', () => ({ GitHubPrsSource: class {} }));
vi.mock('@main/sync/github/reviews-source.js', () => ({ GitHubReviewsSource: class {} }));

vi.mock('@main/activity/index.js', () => ({
  initActivityMonitoring: async () => {
    constructed.activityInits += 1;
  },
  stopActivityMonitoring: () => undefined,
}));

describe('app startup', () => {
  beforeEach(() => {
    constructed.gdocsPoller = 0;
    constructed.sourcePoller = 0;
    constructed.activityInits = 0;
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts no context connector pollers, even for a profile connected to Google and GitHub', async () => {
    const { settingsRepo } = await import('@main/store/index.js');
    settingsRepo.update({
      googleConnected: true,
      githubConnected: true,
      gmailEnabled: true,
      calendarEnabled: true,
      classroomEnabled: true,
      githubTrackingEnabled: true,
      gdocsPollingEnabled: true,
    });

    await import('@main/index.js');
    await vi.waitFor(() => expect(constructed.activityInits).toBe(1));

    expect(constructed.gdocsPoller).toBe(0);
    expect(constructed.sourcePoller).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/main/startup.test.ts`
Expected: FAIL on the assertions (`expected 1 to be +0` for `gdocsPoller`, and `expected 6 to be +0` for `sourcePoller`). Booting `main/index.ts` under a mock is the hard part, so if the test fails EARLIER (a crash while importing or running `main/index.ts`, such as a missing electron member or a function the proxy mock does not cover), extend only the test's mocks until the failure is the poller assertion, and report exactly what you added. If a settings key in the `update` call is rejected, drop only that key and report it. If you cannot make the module boot under mocks after a reasonable effort, stop and report BLOCKED with the exact error rather than weakening the test.

- [ ] **Step 3: Remove the poller startup**

In `app/src/main/index.ts`:

- delete the imports of `GDocsPoller`, `SourcePoller`, `GmailSource`, `CalendarSource`, `ClassroomSource`, `GitHubClient`, `GitHubCommitsSource`, `GitHubPrsSource`, `GitHubReviewsSource`
- from `import { setupIpc, googleAuth, githubAuth } from './ipc/index.js';` drop `googleAuth` and `githubAuth` if they become unused
- from `import { settingsRepo, syncCursors } from './store/index.js';` drop whichever names become unused, deleting the whole import line if none remain; same for `import { eventBus } from './events/bus.js';` if `eventBus` becomes unused
- delete the variables `gdocsPoller`, `googlePollers`, `githubPollers`
- delete from the `app.whenReady().then(...)` callback everything from `gdocsPoller = new GDocsPoller(...)` through `githubPollers.forEach((p) => p.start());`, and put this comment in its place:

```ts
    // Google, Gmail, Classroom, and GitHub context pollers stay off in the buddy pivot, even for
    // accounts that were connected. Their sources and auth are kept; wire them back deliberately
    // (Calendar returns in roadmap M6).
```

- delete from the `before-quit` handler the `gdocsPoller`, `googlePollers`, and `githubPollers` stop code, keeping `isQuitting` and `clearAllTimers()`

Keep `setupIpc(...)` (it restores saved Google, GitHub, and Supabase credentials), `await initActivityMonitoring()`, window creation, the hotkey, and everything else exactly as is. Do not touch `app/src/main/sync/**`, `app/src/main/ipc/**`, settings, or UI.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./app exec vitest run tests/main tests/sync tests/activity`
Expected: PASS, including the unchanged `source-poller` and `gdocs-poller` tests and the new startup test with pristine output.

- [ ] **Step 5: Full gate and commit**

Run from repo root with real exit codes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (the test run takes 3-4 minutes; use a long timeout). Expected: all exit 0.

```bash
git add app/src/main/index.ts app/tests/main/startup.test.ts
git commit -m "fix(main): stop starting Google and GitHub context pollers at boot

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- Spec coverage: pivot spec §5 (no Gmail, Drive, Docs, Classroom, GitHub connectors) and §6 (those sources frozen) and sweep queue item 5 ("previously connected accounts cause no Docs/Gmail/Calendar/Classroom/GitHub polling; app Supabase authentication still restores") are covered by the connected-profile startup test and by leaving `ipc/index.ts` untouched.
- Placeholder scan: none.
- Known follow-ups (not this PR): the Settings and onboarding connector UI (queue items 7 and 11), the activity bus subscribers (idle now), removing credential loading for Google and GitHub if disconnect or migration policy requires it, Calendar re-wiring in roadmap M6.

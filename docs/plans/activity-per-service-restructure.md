# Activity Per-Service Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `app/src/main/activity/` from flat trackers into per-service subfolders (`google/`, `github/`, `notion/`, `local/`), each owning its own OAuth. Enable streaming GitHub commit/PR and Notion page activity into the unified `activity` table so future AI features have richer context.

**Architecture:** Each service is a self-contained folder with `auth.ts` (OAuth flow + keytar storage) + one or more `<tracker>.ts` files (poller/subscriber). The existing unified `activity` table stays — new rows just use dotted `kind` prefixes (`google.docs.revision`, `github.commit`, `notion.page.updated`, `local.screenshot_captured`). New service OAuth secrets stay on `plover-server` (Cloud Run); the client hits `/api/oauth/{service}/exchange` endpoints for the token round-trip.

**Tech Stack:** TypeScript strict, Electron `BrowserWindow` for OAuth redirect capture, `keytar` for token storage, `better-sqlite3` for activity storage, existing `plover-server` Express app for backend OAuth exchange.

## Global Constraints

- **Local-only data.** All service data lands in the local SQLite `activity` table; nothing uploaded except Gemini calls that already have consent gating.
- **Client secrets stay on the backend.** `GITHUB_OAUTH_CLIENT_SECRET` and `NOTION_OAUTH_CLIENT_SECRET` live in Cloud Run Secret Manager; client only sees the client_id and hits `/api/oauth/*/exchange`.
- **Outbound HTTP allowlist:** existing `generativelanguage.googleapis.com`, `www.googleapis.com`, Google OAuth. Add `api.github.com`, `github.com/login/oauth`, `api.notion.com`.
- **TypeScript strict** with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Use destructure + optional chaining, not `!.` (lint rule).
- **No comments.** Follow existing convention.
- **Path-based pnpm filters.** `pnpm --filter ./app run <script>`; colon scripts need explicit `run` keyword.
- **Tests:** TDD Store + auth token exchange. Mock the OAuth `BrowserWindow` and any outbound HTTP with `nock` — no real network in tests.

## File Structure (after all phases)

```
app/src/main/activity/
├── index.ts                    (module entrypoint; unchanged responsibilities)
├── inference.ts                (cross-cutting; stays)
├── retention.ts                (cross-cutting; stays)
├── local/
│   ├── screen-capturer.ts      (moved from activity/)
│   ├── window-tracker.ts       (moved from activity/)
│   ├── folder-watcher.ts       (moved from activity/)
│   └── git-commit-tracker.ts   (moved from activity/, LOCAL git only)
├── google/
│   ├── auth.ts                 (moved from sync/google-auth.ts)
│   ├── gdocs-poller.ts         (moved from sync/gdocs-poller.ts)
│   └── gdocs-subscriber.ts     (moved from activity/gdocs-subscriber.ts)
├── github/
│   ├── auth.ts                 (NEW: OAuth 2.0 device/web flow → keytar)
│   └── commits-poller.ts       (NEW: polls /user/events → activity rows)
└── notion/
    ├── auth.ts                 (NEW: Notion OAuth → keytar)
    └── pages-poller.ts         (NEW: polls /search endpoint → activity rows)

app/src/main/sync/               (DELETED — no callers left)

server/src/routes/oauth/
├── github.ts                   (NEW: /api/oauth/github/exchange)
└── notion.ts                   (NEW: /api/oauth/notion/exchange)
```

Also update: `app/src/main/index.ts` imports, `ipc.ts` (currently imports `GoogleAuth` from `sync/`), all matching test files, and `CLAUDE.md` (remove "Sync is the only module that talks to Google APIs" bullet; add per-service ownership rule).

---

## Phase A — Restructure (no behavior change)

Goal: move files into per-service folders, update imports, delete `sync/`. No new functionality. Must ship green before Phase B/C touch new code.

### Task A1: Move Google auth + poller into `activity/google/`

**Files:**
- Create: `app/src/main/activity/google/auth.ts` (copy of current `app/src/main/sync/google-auth.ts`, unchanged contents; new import paths for `resolveRequiredEnv`)
- Create: `app/src/main/activity/google/gdocs-poller.ts` (copy of current `app/src/main/sync/gdocs-poller.ts`; update relative import of `./google-auth.js` to `./auth.js`)
- Create: `app/src/main/activity/google/gdocs-subscriber.ts` (copy of current `app/src/main/activity/gdocs-subscriber.ts`, unchanged)
- Delete: `app/src/main/sync/google-auth.ts`, `app/src/main/sync/gdocs-poller.ts`, `app/src/main/activity/gdocs-subscriber.ts`, empty `app/src/main/sync/` directory
- Modify: `app/src/main/index.ts` — change `import { GDocsPoller } from './sync/gdocs-poller.js'` to `from './activity/google/gdocs-poller.js'`
- Modify: `app/src/main/ipc.ts:11` — change `import { GoogleAuth } from './sync/google-auth.js'` to `from './activity/google/auth.js'`
- Modify: `app/src/main/activity/index.ts` — change `import { GDocsActivitySubscriber } from './gdocs-subscriber.js'` to `from './google/gdocs-subscriber.js'`
- Move tests: `app/tests/sync/gdocs-poller.test.ts` → `app/tests/activity/google/gdocs-poller.test.ts`, `app/tests/sync/google-auth.test.ts` → `app/tests/activity/google/auth.test.ts`. Update the imports inside each test file to the new paths.
- Delete empty `app/tests/sync/` if nothing else left.

**Interfaces:**
- Consumes: nothing new; all runtime interfaces identical.
- Produces: `activity/google/auth.ts` exports `GoogleAuth`, `AuthenticationError`, `PermissionError`, `GOOGLE_API_SCOPES` — same public shape as before.

- [ ] **Step 1: Run current tests to establish baseline (they must be green)**

```bash
cd /Users/liyu.xiao/Documents/GitHub/BuildWithGeminiHackathon
export PATH=/Users/liyu.xiao/Library/pnpm:$PATH
pnpm --filter ./app run test 2>&1 | tail -20
```
Expected: green (ignoring the known pre-existing App.test.tsx / Onboarding.test.tsx flakes).

- [ ] **Step 2: `git mv` the three files (preserves history)**

```bash
mkdir -p app/src/main/activity/google
git mv app/src/main/sync/google-auth.ts app/src/main/activity/google/auth.ts
git mv app/src/main/sync/gdocs-poller.ts app/src/main/activity/google/gdocs-poller.ts
git mv app/src/main/activity/gdocs-subscriber.ts app/src/main/activity/google/gdocs-subscriber.ts
```

- [ ] **Step 3: Fix the internal `./google-auth.js` import inside `gdocs-poller.ts`**

Change the top of `app/src/main/activity/google/gdocs-poller.ts`:
```ts
import { GoogleAuth, PermissionError, AuthenticationError } from './auth.js';
```
(from the previous `from './google-auth.js'`)

- [ ] **Step 4: Update the three call sites**

`app/src/main/index.ts` — replace the old sync path:
```ts
import { GDocsPoller } from './activity/google/gdocs-poller.js';
```

`app/src/main/ipc.ts` (line ~11):
```ts
import { GoogleAuth } from './activity/google/auth.js';
```

`app/src/main/activity/index.ts` (the subscriber import):
```ts
import { GDocsActivitySubscriber } from './google/gdocs-subscriber.js';
```

- [ ] **Step 5: Move the tests and update their imports**

```bash
mkdir -p app/tests/activity/google
git mv app/tests/sync/gdocs-poller.test.ts app/tests/activity/google/gdocs-poller.test.ts
git mv app/tests/sync/google-auth.test.ts app/tests/activity/google/auth.test.ts
rmdir app/tests/sync
```

Update the test imports to match the new source paths:
- `app/tests/activity/google/gdocs-poller.test.ts`: `import { GoogleAuth } from '../../../src/main/activity/google/auth';` and `import { GDocsPoller } from '../../../src/main/activity/google/gdocs-poller';` (note: three `../` because tests moved one level deeper).
- `app/tests/activity/google/auth.test.ts`: `import { GoogleAuth, AuthenticationError } from '../../../src/main/activity/google/auth';`

- [ ] **Step 6: Delete the now-empty `sync/` directory**

```bash
rmdir app/src/main/sync 2>/dev/null || true
```

- [ ] **Step 7: Run typecheck + lint + test**

```bash
pnpm --filter ./app run typecheck
pnpm --filter ./app run lint
pnpm --filter ./app run test
```
Expected: green (same baseline as Step 1).

- [ ] **Step 8: Commit**

```bash
git add -A app/src/main/activity/google app/src/main/index.ts app/src/main/ipc.ts app/src/main/activity/index.ts app/tests/activity/google
git commit -m "refactor(activity): move Google trackers under activity/google/"
```

---

### Task A2: Move local trackers into `activity/local/`

**Files:**
- Move: `app/src/main/activity/{screen-capturer,window-tracker,folder-watcher,git-commit-tracker}.ts` → `app/src/main/activity/local/`
- Move corresponding test files: `app/tests/activity/{screen-capturer,window-tracker,folder-watcher,git-commit-tracker}.test.ts` → `app/tests/activity/local/`
- Modify: `app/src/main/activity/index.ts` — update relative imports from `./screen-capturer.js` etc. to `./local/screen-capturer.js` (same for the other three)
- Modify: `app/src/main/index.ts:6-8` — update `FolderWatcher`, `InferenceEngine`, `GitCommitTracker` imports. NOTE: `InferenceEngine` stays at `./activity/inference.js`; only the three local ones change path.
- Modify: Any moved test's imports of `../../src/main/activity/<name>.js` → `../../../src/main/activity/local/<name>.js` (added one `../`).

**Interfaces:**
- Consumes: nothing new.
- Produces: identical public shape; only import paths change.

- [ ] **Step 1: Move source files**

```bash
mkdir -p app/src/main/activity/local
git mv app/src/main/activity/screen-capturer.ts app/src/main/activity/local/screen-capturer.ts
git mv app/src/main/activity/window-tracker.ts app/src/main/activity/local/window-tracker.ts
git mv app/src/main/activity/folder-watcher.ts app/src/main/activity/local/folder-watcher.ts
git mv app/src/main/activity/git-commit-tracker.ts app/src/main/activity/local/git-commit-tracker.ts
```

- [ ] **Step 2: Move test files**

```bash
mkdir -p app/tests/activity/local
git mv app/tests/activity/screen-capturer.test.ts app/tests/activity/local/screen-capturer.test.ts
git mv app/tests/activity/window-tracker.test.ts app/tests/activity/local/window-tracker.test.ts 2>/dev/null || echo "no window-tracker test"
git mv app/tests/activity/folder-watcher.test.ts app/tests/activity/local/folder-watcher.test.ts 2>/dev/null || echo "no folder-watcher test"
git mv app/tests/activity/git-commit-tracker.test.ts app/tests/activity/local/git-commit-tracker.test.ts 2>/dev/null || echo "no git-commit-tracker test"
```

- [ ] **Step 3: Update imports in `activity/index.ts`**

Change the three imports at the top:
```ts
import { WindowTracker } from './local/window-tracker.js';
import { ScreenCapturer } from './local/screen-capturer.js';
```
(Leave `runRetention` from `./retention.js` and the `google/` subscriber import alone.)

- [ ] **Step 4: Update imports in `app/src/main/index.ts`**

```ts
import { FolderWatcher } from './activity/local/folder-watcher.js';
import { GitCommitTracker } from './activity/local/git-commit-tracker.js';
```
(`InferenceEngine` at `./activity/inference.js` stays as-is.)

- [ ] **Step 5: Update the moved test imports**

For each of the four moved test files, prefix one more `../` to the source path:
```ts
// before: import { ScreenCapturer } from '../../src/main/activity/screen-capturer.js';
import { ScreenCapturer } from '../../../src/main/activity/local/screen-capturer.js';
```
Same shape for `WindowTracker`, `FolderWatcher`, `GitCommitTracker`.

- [ ] **Step 6: Typecheck + lint + test**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(activity): move local trackers under activity/local/"
```

---

### Task A3: Update CLAUDE.md architecture rule

**Files:**
- Modify: `CLAUDE.md` — replace the current "Architecture rules" bullet about Sync being the sole owner of Google APIs.

- [ ] **Step 1: Edit the "Architecture rules (load-bearing)" section in `CLAUDE.md`**

Replace this line:
```
- **Sync** is the **only** module that talks to Google APIs.
```
with:
```
- **Activity** owns all external-service integrations, grouped one folder per service (`activity/google/`, `activity/github/`, `activity/notion/`, `activity/local/`). Each service subfolder owns its own OAuth (`auth.ts`) and its trackers; nothing else in the codebase talks to that service's API.
```

Also add to the "Workspace layout" section:
```
├── app/src/main/activity/
│   ├── google/     # Google OAuth + Docs poller
│   ├── github/     # GitHub OAuth + commit/PR poller
│   ├── notion/     # Notion OAuth + page poller
│   └── local/      # screen, window, folder, local-git trackers
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): update architecture rule for per-service activity layout"
```

---

## Phase B — GitHub integration

Goal: `activity/github/auth.ts` performs OAuth against github.com and stores the token via keytar. `activity/github/commits-poller.ts` polls `/users/{user}/events` on an interval and logs `github.commit` and `github.pr_opened` rows into `activity`.

### Task B1: Backend `/api/oauth/github/exchange` endpoint

**Files:**
- Create: `server/src/routes/oauth-github.ts`
- Modify: `server/src/index.ts` — register the new route and pull `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET` from env
- Modify: `server/.env.example` — document the two new env vars

**Interfaces:**
- Consumes: `POST /api/oauth/github/exchange` with `{ code, redirect_uri }` in body.
- Produces: `{ access_token: string, scope: string, token_type: 'bearer' }` on success, `{ error: string }` with 4xx on failure.

- [ ] **Step 1: Write the test**

Create `server/tests/oauth-github.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('POST /api/oauth/github/exchange', () => {
  beforeEach(() => {
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-secret';
  });
  afterEach(() => nock.cleanAll());

  it('exchanges code for token', async () => {
    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, { access_token: 'gho_abc', scope: 'repo,user', token_type: 'bearer' });
    const app = createApp();
    const res = await request(app)
      .post('/api/oauth/github/exchange')
      .send({ code: 'temp-code', redirect_uri: 'http://localhost:53817/callback' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ access_token: 'gho_abc', token_type: 'bearer' });
  });

  it('returns 400 when code missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/oauth/github/exchange').send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify FAIL**

```bash
pnpm --filter ./server run test 2>&1 | tail -10
```
Expected: FAIL (module not found or 404).

- [ ] **Step 3: Write the route**

Create `server/src/routes/oauth-github.ts`:
```ts
import { Router } from 'express';

export function githubOauthRoute(): Router {
  const router = Router();
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  router.post('/exchange', async (req, res) => {
    const { code, redirect_uri: redirectUri } = req.body as {
      code?: string;
      redirect_uri?: string;
    };
    if (!code || !redirectUri) return res.status(400).json({ error: 'missing code or redirect_uri' });
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'server not configured' });
    }
    const gh = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!gh.ok) return res.status(502).json({ error: 'github exchange failed' });
    const data = (await gh.json()) as {
      access_token?: string;
      scope?: string;
      token_type?: string;
      error?: string;
    };
    if (!data.access_token) return res.status(400).json({ error: data.error ?? 'no access_token' });
    return res.json(data);
  });

  return router;
}
```

Register in `server/src/index.ts` (near the other routes):
```ts
import { githubOauthRoute } from './routes/oauth-github.js';
// …
app.use('/api/oauth/github', githubOauthRoute());
```

Add to `server/.env.example`:
```
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

- [ ] **Step 4: Run test to verify PASS**

```bash
pnpm --filter ./server run test
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): add GitHub OAuth exchange endpoint"
```

---

### Task B2: `activity/github/auth.ts` — OAuth via BrowserWindow

**Files:**
- Create: `app/src/main/activity/github/auth.ts`
- Create: `app/tests/activity/github/auth.test.ts`

**Interfaces:**
- Consumes: `resolveRequiredEnv` from `../../config/env.js` for `GITHUB_OAUTH_CLIENT_ID`. Uses `PLOVER_BACKEND_URL` to POST the code exchange.
- Produces: `GitHubAuth` class with `authorize(): Promise<void>`, `getAccessToken(): Promise<string | null>`, `signOut(): Promise<void>`. Same `AuthenticationError` shape as the Google auth for consistency.

- [ ] **Step 1: Write the test (mock BrowserWindow, mock fetch)**

Create `app/tests/activity/github/auth.test.ts`. Use `vi.hoisted` to declare `mockLoadURL`, `mockOpenExternal`, and `mockKeychain` before the electron mock. Mock `keytar` and stub `fetch` to return the exchange payload. Assert: authorize opens the GitHub OAuth URL, captures `?code=…` from the redirect, POSTs to `/api/oauth/github/exchange`, and stores the returned `access_token` in keytar under service `plover`, account `github-access-token`. See `app/tests/activity/google/auth.test.ts` for the exact `vi.hoisted` + `vi.mock('electron', …)` shape to mirror.

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/activity/github/auth.test.ts
```
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement `auth.ts`**

Create `app/src/main/activity/github/auth.ts`:
```ts
import { BrowserWindow, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import keytar from 'keytar';
import { resolveRequiredEnv } from '../../config/env.js';

const CLIENT_ID = resolveRequiredEnv('GITHUB_OAUTH_CLIENT_ID', { devFallback: 'mock-github-id' });
const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'github-access-token';
const REDIRECT_URI = 'http://127.0.0.1:53817/callback';
const AUTHORIZE_TIMEOUT_MS = 5 * 60 * 1000;

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class GitHubAuth {
  async authorize(): Promise<void> {
    const state = randomBytes(16).toString('hex');
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'repo user');
    authUrl.searchParams.set('state', state);

    const code = await new Promise<string>((resolve, reject) => {
      const win = new BrowserWindow({ width: 500, height: 700, show: true });
      const timer = setTimeout(() => {
        win.destroy();
        reject(new AuthenticationError('OAuth timed out'));
      }, AUTHORIZE_TIMEOUT_MS);
      win.webContents.on('will-redirect', (_event, url) => {
        const parsed = new URL(url);
        const returned = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        if (returned && returnedState === state) {
          clearTimeout(timer);
          win.destroy();
          resolve(returned);
        }
      });
      void win.loadURL(authUrl.toString());
      void shell.openExternal(authUrl.toString()).catch(() => {});
    });

    const backendUrl = resolveRequiredEnv('PLOVER_BACKEND_URL', {
      devFallback: 'http://localhost:3000',
    });
    const res = await fetch(`${backendUrl}/api/oauth/github/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
    });
    if (!res.ok) throw new AuthenticationError(`exchange failed: ${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new AuthenticationError('no access_token in response');
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, data.access_token);
  }

  async getAccessToken(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  async signOut(): Promise<void> {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
pnpm --filter ./app exec vitest run tests/activity/github/auth.test.ts
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/activity/github/ app/tests/activity/github/
git commit -m "feat(activity/github): OAuth flow with backend-mediated token exchange"
```

---

### Task B3: `activity/github/commits-poller.ts` + wiring

**Files:**
- Create: `app/src/main/activity/github/commits-poller.ts`
- Create: `app/tests/activity/github/commits-poller.test.ts`
- Modify: `app/src/main/activity/index.ts` — init and stop the poller alongside the existing `gdocsSubscriber` pattern
- Modify: `app/src/main/store/repos/settings.ts` — add `githubTrackingEnabled: boolean` (default `false`)
- Add DB migration: schema `settings` gets a new column (migration v5). Reuse the v4 pattern (see `app/src/main/store/db.ts`).

**Interfaces:**
- Consumes: `GitHubAuth.getAccessToken()`, `activityRepo.log(kind, payload)`, `settingsRepo.get('githubTrackingEnabled')`.
- Produces: activity rows with kinds `github.commit` and `github.pr_opened`. Payload shape for `github.commit`: `{ sha: string, repo: string, message: string, url: string, timestamp: string }`. Payload shape for `github.pr_opened`: `{ number: number, repo: string, title: string, url: string, timestamp: string }`.

- [ ] **Step 1: Write the migration + settings test**

Add a test file `app/tests/store/migrations-v5.test.ts` verifying that running migrations on a v4-shaped DB adds the `github_tracking_enabled` column defaulted to `0` and that a fresh DB also picks it up. Mirror the v4 test's structure (`app/tests/store/migrations-v4.test.ts`).

- [ ] **Step 2: Add the migration**

In `app/src/main/store/db.ts`, add migration v5 after the v4 block:
```ts
if (currentVersion < 5) {
  db.exec(`ALTER TABLE settings ADD COLUMN github_tracking_enabled INTEGER NOT NULL DEFAULT 0`);
  db.pragma('user_version = 5');
}
```

Update `SettingsRepo`:
```ts
// in the row → object mapper, add:
githubTrackingEnabled: row.github_tracking_enabled === 1,
// in update(), accept and persist githubTrackingEnabled
```

Run migration tests:
```bash
pnpm --filter ./app exec vitest run tests/store/migrations-v5.test.ts tests/store/settings-repo.test.ts
```
Expected: green.

- [ ] **Step 3: Write the poller test**

Create `app/tests/activity/github/commits-poller.test.ts`. Set up an in-memory DB + `runMigrations`, seed `settings` with `githubTrackingEnabled: true`, mock `GitHubAuth.getAccessToken` to return `'tok'`, stub `fetch` to return a canned `/users/{user}/events` response with one `PushEvent` and one `PullRequestEvent`. Assert that `pollOnce()` logs one `github.commit` row per commit in the push and one `github.pr_opened` row, both with the expected payload shape.

- [ ] **Step 4: Run test to verify FAIL**

```bash
pnpm --filter ./app exec vitest run tests/activity/github/commits-poller.test.ts
```
Expected: FAIL — file doesn't exist.

- [ ] **Step 5: Implement the poller**

Create `app/src/main/activity/github/commits-poller.ts`:
```ts
import { GitHubAuth } from './auth.js';
import type { ActivityRepo } from '../../store/repos/activity.js';
import type { SettingsRepo } from '../../store/repos/settings.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export class GitHubCommitsPoller {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private auth: GitHubAuth = new GitHubAuth(),
    private now: () => Date = () => new Date(),
  ) {}

  start(): void {
    if (this.timer) return;
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollOnce(): Promise<void> {
    const settings = this.settingsRepo.get();
    if (!settings.githubTrackingEnabled) return;
    const token = await this.auth.getAccessToken();
    if (!token) return;

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!userRes.ok) return;
    const { login } = (await userRes.json()) as { login: string };

    const eventsRes = await fetch(`https://api.github.com/users/${login}/events?per_page=30`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!eventsRes.ok) return;
    const events = (await eventsRes.json()) as Array<{
      type: string;
      created_at: string;
      repo: { name: string };
      payload: Record<string, unknown>;
    }>;

    for (const evt of events) {
      if (evt.type === 'PushEvent') {
        const commits = (evt.payload.commits ?? []) as Array<{
          sha: string;
          message: string;
          url: string;
        }>;
        for (const c of commits) {
          this.activityRepo.log('github.commit', {
            sha: c.sha,
            repo: evt.repo.name,
            message: c.message,
            url: c.url,
            timestamp: evt.created_at,
          });
        }
      } else if (evt.type === 'PullRequestEvent') {
        const pr = evt.payload.pull_request as { number: number; title: string; html_url: string };
        const action = evt.payload.action as string;
        if (action === 'opened') {
          this.activityRepo.log('github.pr_opened', {
            number: pr.number,
            repo: evt.repo.name,
            title: pr.title,
            url: pr.html_url,
            timestamp: evt.created_at,
          });
        }
      }
    }
  }
}
```

- [ ] **Step 6: Run test to verify PASS**

```bash
pnpm --filter ./app exec vitest run tests/activity/github/commits-poller.test.ts
```
Expected: green.

- [ ] **Step 7: Wire into `activity/index.ts`**

Follow the exact pattern used for `gdocsSubscriber`:
```ts
import { GitHubCommitsPoller } from './github/commits-poller.js';
// …
let githubPoller: GitHubCommitsPoller | null = null;
// in initActivityMonitoring():
if (!githubPoller) {
  githubPoller = new GitHubCommitsPoller(activityRepo, settingsRepo);
  githubPoller.start();
}
// in stopActivityMonitoring():
if (githubPoller) {
  githubPoller.stop();
  githubPoller = null;
}
```

- [ ] **Step 8: Full suite green**

```bash
pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app run test
```

- [ ] **Step 9: Commit**

```bash
git add -A app/
git commit -m "feat(activity/github): poll commits and PRs into activity table"
```

---

## Phase C — Notion integration

Symmetric to Phase B. Skeleton only — detailed steps mirror B1/B2/B3 with Notion endpoints.

### Task C1: Backend `/api/oauth/notion/exchange` endpoint

Mirrors B1. Notion exchange endpoint: `POST https://api.notion.com/v1/oauth/token` with `Authorization: Basic base64(client_id:client_secret)` and body `{ grant_type: 'authorization_code', code, redirect_uri }`. Returns `{ access_token, workspace_id, workspace_name, bot_id }`. Test with `nock`; env vars `NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`.

### Task C2: `activity/notion/auth.ts` — Notion OAuth

Mirrors B2. Auth URL: `https://api.notion.com/v1/oauth/authorize?client_id=…&response_type=code&owner=user&redirect_uri=…&state=…`. Store access_token in keytar under service `plover`, account `notion-access-token`. Notion tokens are long-lived — no refresh flow needed for v1.

### Task C3: `activity/notion/pages-poller.ts` + wiring

Mirrors B3. Poll `POST https://api.notion.com/v1/search` with `{ page_size: 20, sort: { direction: 'descending', timestamp: 'last_edited_time' } }`. Headers: `Authorization: Bearer <token>`, `Notion-Version: 2022-06-28`. Emit `notion.page.updated` activity rows with payload `{ pageId, title, url, lastEditedAt, workspaceId }`. Migration v6 adds `notion_tracking_enabled INTEGER NOT NULL DEFAULT 0` to settings.

---

## Phase D — Settings UI hooks (optional, defer if scope creep)

Settings page needs three new rows (one per external service) — a toggle + a "Connect / Disconnect" button that calls `github:authorize` / `notion:authorize` IPC channels. Add the IPC channels to `ipc.ts` and preload. Skip if Phase 1 UI work is out of scope for this cycle; the poller default-off state means the backend can ship without the UI.

---

## Self-Review Notes

1. **Spec coverage:** All four services covered (Google via move, GitHub new, Notion new, local via move). Unified `activity` table preserved. Per-service OAuth confirmed (each has its own `auth.ts`).
2. **Placeholder scan:** Phase C tasks are described as "mirrors B*" with concrete endpoint/scope differences; that's an intentional summary since the shape is fully specified. Before executing Phase C, the executing subagent should draft the concrete test + implementation code following Phase B as a template.
3. **Type consistency:** `GoogleAuth` / `GitHubAuth` / `NotionAuth` share the shape `{ authorize(), getAccessToken(), signOut() }`. Keytar service is always `plover`; accounts differ per service (`google-refresh-token`, `github-access-token`, `notion-access-token`). Migration versions bump monotonically (v5 for github flag, v6 for notion flag).

Order: A1 → A2 → A3, then B1 → B2 → B3, then C1 → C2 → C3, then optional D. Do NOT interleave phases; each phase must ship green.

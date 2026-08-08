# MCP - Phase 2 (GitHub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub context source that ingests **only new diffs since the last snapshot** — commits, pull requests, and reviews/mentions directed at the user — into the `activity` stream, reusing the Phase 1 connector framework.

**Architecture:** New GitHub provider under `Sync`, mirroring the Google connectors from Phase 1. GitHub OAuth **device flow** stores an access token in `keytar`; a thin `fetch`-based client hits `api.github.com` (no new dependency). Three `ContextSource` implementations (commits / PRs / reviews) are driven by the existing `SourcePoller` scaffold, persist cursors in `sync_cursors`, and emit typed bus events that subscribers write to `ActivityRepo` as new `github_*` kinds. Inference consumes them automatically (it reads all activity via `listSince`).

**Tech Stack:** Electron main (TypeScript strict), `better-sqlite3`, native `fetch` (Node 22 global) against `api.github.com`, `keytar`, `zod`, `vitest` + `nock`, pnpm workspace.

**Depends on:** Phase 1 (`feat/mcp-phase-1-google`, PR #321). This plan's branch MUST be cut from that branch (or from `main` after #321 merges), because it reuses `SyncCursorsRepo`, `SourcePoller`/`ContextSource`, `assertAllowedHost`/`ALLOWED_HOSTS`, the `ActivityRow`/`parseRow` pattern, and the settings-toggle pattern — none of which exist on `main` yet.

## Global Constraints

- TypeScript strict: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Do not loosen.
- No comments unless the WHY is non-obvious; no comment references to this task/plan.
- **No new dependencies** — the corporate registry is blocked in this environment; `pnpm install`/`pnpm add` will fail. Use the Node 22 global `fetch`; do NOT add `@octokit/*`.
- No real network in tests — mock `keytar`, mock `electron`, and stub `fetch` (see test harness). Use `nock` only if a test exercises a real HTTP client; the `fetch`-stub approach below is preferred.
- User OAuth tokens live only in `keytar` (service `plover`), never in SQLite.
- Provider APIs are called directly from `Sync` with the user's token (like Google); NOT proxied through `plover-server`.
- First connect of any source emits **no** historical backlog — record the current cursor and emit nothing.
- Add `api.github.com` to the allowlist (`ALLOWED_HOSTS`) and to the CLAUDE.md allowlist bullet.
- Verify with `pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app exec vitest run` — green — before claiming any task done.
- **Test environment:** the default shell is misconfigured. Prepend, in the same command as any pnpm/node call:
  `export PATH="$HOME/Library/pnpm:/Users/liyu.xiao/.local/share/mise/installs/node/22/bin:$PATH"`. Do NOT run `pnpm install`. If `better-sqlite3`/`keytar` throw an ABI error, run `pnpm --filter ./app rebuild better-sqlite3 keytar`.
- **Git rules (subagents):** NEVER run `git stash`/`checkout`/`reset`/`rebase`/`clean`/`restore`; only `git add <named files>` + `git commit`. Stage only the files a task names.
- Commit trailer (exact): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Reused Phase-1 primitives (do not re-create)

- `SyncCursorsRepo` (`app/src/main/store/repos/sync-cursors.ts`): `get(provider, source)`, `set(provider, source, cursor)`, `clear(provider)`. Exported as `syncCursors` from `app/src/main/store/index.ts`.
- `SourcePoller` + `ContextSource` (`app/src/main/sync/source-poller.ts`): `ContextSource = { provider; source; enabled(settings); poll(cursor: string | null): Promise<string> }`. `SourcePoller(source, cursors, settingsRepo, intervalMs, preflight?)` with `start()`/`stop()`; enforces pauseAllTracking → enabled → preflight → reentrancy, first-snapshot (cursor null), persist-if-changed.
- `assertAllowedHost` / `ALLOWED_HOSTS` (`app/src/main/http/allowlist.ts`).
- Activity pattern: payload interface + `EventPayloads` entry in `app/src/shared/events.ts`; zod schema + `ActivityRow` union member (before the open fallback) in `app/src/main/store/repos/activity-types.ts`; `parseRow` case in `app/src/main/store/repos/activity.ts`; subscriber under `app/src/main/activity/<x>-subscriber/` using `gate(settingsRepo, '<flag>')`, started/stopped in `app/src/main/activity/index.ts`.
- Settings pattern: add booleans to `SettingsData` + `getAll()` + `update()` in `app/src/main/store/repos/settings.ts` (default-on = `map.get(k) !== 'false'`).

## Naming reference (keep exact)

- Auth: `app/src/main/sync/github-auth.ts` → `class GitHubAuth` with `authorizeDeviceFlow(): Promise<void>`, `loadSavedCredentials(): Promise<boolean>`, `disconnect(): Promise<void>`, `isAuthorized(): Promise<boolean>`, `get token(): string | null`. Keytar: service `plover`, account `github-access-token`. Env: `GITHUB_CLIENT_ID` (devFallback `'mock-client-id'`).
- HTTP client: `app/src/main/sync/github/github-client.ts` → `class GitHubClient` constructed with `(auth: { token: string | null })`; method `request(path: string, opts?: { etag?: string; search?: boolean }): Promise<{ status: number; etag: string | null; data: unknown }>`. Base `https://api.github.com`. Sends `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `If-None-Match: <etag>` when given. Returns `status: 304` with `data: null` on Not-Modified.
- Sources (`app/src/main/sync/github/`): `commits-source.ts` (`GitHubCommitsSource`), `prs-source.ts` (`GitHubPrsSource`), `reviews-source.ts` (`GitHubReviewsSource`). Each `implements ContextSource`, `provider = 'github'`, `source = 'commits' | 'prs' | 'reviews'`, ctor `(client: GitHubClient, settingsRepo: SettingsRepo, eventBus)`.
- Subscribers (`app/src/main/activity/github-*-subscriber/`): `GitHubCommitActivitySubscriber`, `GitHubPrActivitySubscriber`, `GitHubReviewActivitySubscriber` (all gate on `githubTrackingEnabled`).
- Events (`shared/events.ts`): `'github.commit'` → `GitHubCommitPayload`, `'github.pr'` → `GitHubPrPayload`, `'github.review'` → `GitHubReviewPayload`.
- Activity kinds: `github_commit`, `github_pr`, `github_review`.
- Settings: `githubConnected: boolean`, `githubTrackingEnabled: boolean` (default on), `githubWatchedRepos: string[]` (default `[]`).
- Cursor rows (provider `github`): `commits` (JSON map `{ "<owner/repo>": "<ISO ts>" }`), `prs` (ISO ts), `reviews` (ISO ts).

## Shared test harness (top of each new `*.test.ts`)

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
const { mockKeychain } = vi.hoisted(() => ({ mockKeychain: new Map<string, string>() }));
vi.mock('keytar', () => ({ default: {
  getPassword: vi.fn(async (s: string, a: string) => mockKeychain.get(`${s}:${a}`) ?? null),
  setPassword: vi.fn(async (s: string, a: string, v: string) => void mockKeychain.set(`${s}:${a}`, v)),
  deletePassword: vi.fn(async (s: string, a: string) => { mockKeychain.delete(`${s}:${a}`); return true; }),
} }));
vi.mock('electron', () => ({ shell: { openExternal: vi.fn().mockResolvedValue(true) }, app: { isPackaged: false } }));
```

For source tests, inject a fake client — do NOT hit the network:
```ts
const requests: { path: string; etag?: string }[] = [];
const fakeClient = { request: vi.fn(async (path: string, opts?: { etag?: string }) => {
  requests.push({ path, etag: opts?.etag });
  return nextResponse; // set per test: { status, etag, data }
}) } as unknown as GitHubClient;
```

---

## Task 1: Add `api.github.com` to the allowlist

**Files:**
- Modify: `app/src/main/http/allowlist.ts` (add `'api.github.com'` to `ALLOWED_HOSTS`)
- Modify: `app/tests/http/allowlist.test.ts` (assert `api.github.com` allowed)
- Modify: `CLAUDE.md` (add `api.github.com` to the allowlist bullet)

- [ ] **Step 1: Failing test** — add to the "allows the enumerated hosts" case: `'api.github.com'`.
- [ ] **Step 2: Run** `pnpm --filter ./app exec vitest run tests/http/allowlist.test.ts` → FAIL.
- [ ] **Step 3: Implement** — add `'api.github.com',` to the `ALLOWED_HOSTS` frozen array.
- [ ] **Step 4: Run** → PASS. Update the CLAUDE.md allowlist bullet to list `api.github.com`.
- [ ] **Step 5: Commit** (`feat(http): allowlist api.github.com`).

---

## Task 2: `GitHubAuth` — device-flow OAuth + keytar

**Files:**
- Create: `app/src/main/sync/github-auth.ts`
- Create: `app/tests/sync/github-auth.test.ts`

**Interfaces:**
- Produces: `GitHubAuth` (see naming reference). `authorizeDeviceFlow()` performs the two-step device flow: POST `https://github.com/login/device/code` (`client_id`, `scope='repo read:user'`) → open `verification_uri` via `shell.openExternal` and log the `user_code` → poll POST `https://github.com/login/oauth/access_token` (`client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code`) every `interval` seconds until `access_token` (handle `authorization_pending`/`slow_down`) → `keytar.setPassword(service, 'github-access-token', token)`. `token` getter returns the in-memory token; `loadSavedCredentials()` rehydrates from keytar; `isAuthorized()` = `!!token`.

- [ ] **Step 1: Write the failing test** (device-code → poll → token stored)

```ts
// harness (keytar + electron mocks) at top
import { GitHubAuth } from '../../src/main/sync/github-auth';
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('GitHubAuth device flow', () => {
  beforeEach(() => { mockKeychain.clear(); fetchMock.mockReset(); });

  it('runs device flow, stores the token, and reports authorized', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ device_code: 'dc', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', interval: 0, expires_in: 900 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'authorization_pending' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_test', token_type: 'bearer', scope: 'repo,read:user' }) });
    const auth = new GitHubAuth();
    await auth.authorizeDeviceFlow();
    expect(await auth.isAuthorized()).toBe(true);
    expect(auth.token).toBe('gho_test');
    expect(mockKeychain.get('plover:github-access-token')).toBe('gho_test');
  });

  it('loadSavedCredentials rehydrates from keytar', async () => {
    mockKeychain.set('plover:github-access-token', 'gho_saved');
    const auth = new GitHubAuth();
    expect(await auth.loadSavedCredentials()).toBe(true);
    expect(auth.token).toBe('gho_saved');
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement `github-auth.ts`.** Use `resolveRequiredEnv('GITHUB_CLIENT_ID', { devFallback: 'mock-client-id' })` (same helper `google-auth.ts` uses). Device-code POSTs send `Accept: application/json`. Poll loop respects `interval` (seconds → ms; in tests interval is 0), treats `authorization_pending` as continue, `slow_down` as +5s, any other `error` as throw `AuthenticationError`. On success store the token in keytar and memory. Reuse the `AuthenticationError` class shape from `google-auth.ts` (define locally).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** (`feat(sync): GitHub device-flow auth + keytar token`).

---

## Task 3: `GitHubClient` — fetch wrapper with ETag + rate-limit awareness

**Files:**
- Create: `app/src/main/sync/github/github-client.ts`
- Create: `app/tests/sync/github-client.test.ts`

**Interfaces:**
- Consumes: `GitHubAuth` (only its `token`).
- Produces: `GitHubClient.request(path, opts?)` (see naming reference). Prepends `https://api.github.com` (path may be absolute for `/search/...`). Calls `assertAllowedHost` on the final URL before fetching. Sends auth + version headers, and `If-None-Match` when `opts.etag`. Returns `{ status, etag: response.headers.get('etag'), data: status === 304 ? null : await response.json() }`. On `403` with `x-ratelimit-remaining: 0`, throw a typed `RateLimitError` carrying the `x-ratelimit-reset` epoch (callers swallow it; the poller will retry next tick).

- [ ] **Step 1: Failing test**

```ts
import { GitHubClient } from '../../src/main/sync/github/github-client';
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function res(status: number, body: unknown, headers: Record<string,string> = {}) {
  return { status, headers: { get: (h: string) => headers[h.toLowerCase()] ?? null }, json: async () => body };
}

describe('GitHubClient', () => {
  beforeEach(() => fetchMock.mockReset());

  it('sends auth + version headers and returns parsed data + etag', async () => {
    fetchMock.mockResolvedValueOnce(res(200, [{ sha: 'abc' }], { etag: 'W/"e1"' }));
    const c = new GitHubClient({ token: 'gho_x' });
    const r = await c.request('/repos/o/r/commits?since=2026-01-01T00:00:00Z');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/o/r/commits?since=2026-01-01T00:00:00Z');
    expect(init.headers.Authorization).toBe('Bearer gho_x');
    expect(r).toEqual({ status: 200, etag: 'W/"e1"', data: [{ sha: 'abc' }] });
  });

  it('returns status 304 with null data on Not-Modified and forwards If-None-Match', async () => {
    fetchMock.mockResolvedValueOnce(res(304, null, { etag: 'W/"e1"' }));
    const c = new GitHubClient({ token: 'gho_x' });
    const r = await c.request('/x', { etag: 'W/"e1"' });
    expect(fetchMock.mock.calls[0][1].headers['If-None-Match']).toBe('W/"e1"');
    expect(r.status).toBe(304); expect(r.data).toBeNull();
  });

  it('throws RateLimitError on 403 with zero remaining', async () => {
    fetchMock.mockResolvedValueOnce(res(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }));
    const c = new GitHubClient({ token: 'gho_x' });
    await expect(c.request('/x')).rejects.toThrow(/rate limit/i);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** (`feat(sync): GitHub fetch client with ETag + rate-limit handling`).

---

## Task 4: Settings — `githubConnected` / `githubTrackingEnabled` / `githubWatchedRepos`

**Files:**
- Modify: `app/src/main/store/repos/settings.ts` (interface + `getAll` + `update`)
- Modify: `app/tests/store/settings-repo.test.ts`

**Interfaces:** `githubConnected: boolean` (default false, `=== 'true'`), `githubTrackingEnabled: boolean` (default on, `!== 'false'`), `githubWatchedRepos: string[]` (default `[]`, JSON).

- [ ] **Step 1: Failing tests** (defaults; persistence of a repo list + a false toggle) — mirror the Phase-1 `gmailEnabled` tests + the `watchedFolders` JSON-array pattern.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (three keys across interface/getAll/update; `githubWatchedRepos` parsed like `watchedFolders`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** (`feat(store): GitHub connection + tracking + watched-repos settings`).

---

## Task 5: Commits source + `github_commit` kind + subscriber

**Files:**
- Modify: `app/src/shared/events.ts`, `app/src/main/store/repos/activity-types.ts`, `app/src/main/store/repos/activity.ts`
- Create: `app/src/main/sync/github/commits-source.ts`, `app/src/main/activity/github-commit-subscriber/github-commit-subscriber.ts`
- Create: `app/tests/sync/github-commits-source.test.ts`, `app/tests/activity/github-commit-subscriber.test.ts`

**Interfaces:**
- `GitHubCommitPayload = { repo: string; sha: string; message: string; author: string; url: string; committedAt: string }`; event `'github.commit'`; kind `github_commit`.
- `GitHubCommitsSource implements ContextSource` (`source = 'commits'`). `enabled(s) = s.githubConnected && s.githubTrackingEnabled && s.githubWatchedRepos.length > 0`. Cursor is a JSON map `{ "<owner/repo>": "<ISO ts>" }`.
  - `poll(null)`: seed — set each watched repo's ts to `now`, emit nothing, return the JSON map.
  - `poll(cursor)`: parse map; for each `githubWatchedRepos` repo, `GET /repos/{repo}/commits?since=<repoTs||now>` (per-repo ETag stored in a second cursor row is out of scope; use `since`); for each commit newer than repoTs, emit `github.commit` `{ repo, sha, message: commit.commit.message, author: commit.author?.login ?? commit.commit.author.name, url: commit.html_url, committedAt: commit.commit.author.date }`; advance that repo's ts to the max committedAt seen. Return the updated JSON map. Dedupe by sha within the poll.

- [ ] **Step 1:** Add payload + event, zod schema + union member (before fallback) + `parseRow` case — mirror the Phase-1 `gmail_message` wiring exactly.
- [ ] **Step 2: Failing source test** (first-snapshot seeds map + emits nothing + does not call the API for commits; second poll emits commits since per-repo ts and advances the map). Use the injected `fakeClient`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement `GitHubCommitsSource`.** **Step 5: Run** → PASS.
- [ ] **Step 6: Subscriber test + impl** (`GitHubCommitActivitySubscriber`, gate `githubTrackingEnabled`), mirroring `gmail-subscriber`. Run → PASS.
- [ ] **Step 7: Commit** (`feat(sync): GitHub commits source + github_commit activity`).

---

## Task 6: PRs source + `github_pr` kind + subscriber

**Files:** analogous to Task 5 (`prs-source.ts`, `github-pr-subscriber/`, tests) + shared-file additions.

**Interfaces:**
- `GitHubPrPayload = { repo: string; number: number; title: string; state: string; action: string; url: string; updatedAt: string }`; event `'github.pr'`; kind `github_pr`.
- `GitHubPrsSource` (`source = 'prs'`), cursor = ISO ts. `enabled = githubConnected && githubTrackingEnabled`.
  - `poll(null)`: return `now`, emit nothing.
  - `poll(cursor)`: `GET /search/issues?q=is:pr+involves:@me+updated:>=<cursor>&sort=updated&order=asc&per_page=50`. For each `item`, derive `repo` from `item.repository_url` (`.../repos/{owner}/{name}` → `owner/name`), `number: item.number`, `title`, `state: item.state`, `action: item.pull_request?.merged_at ? 'merged' : item.state === 'closed' ? 'closed' : 'updated'`, `url: item.html_url`, `updatedAt: item.updated_at`. Emit `github.pr` per item; return the max `updated_at` (or `cursor` if none). Dedupe by `(repo, number, updated_at)`.

- [ ] Steps mirror Task 5 (payload/schema/union/parseRow; failing source test with a fake search response; impl; subscriber `GitHubPrActivitySubscriber`). Commit (`feat(sync): GitHub PRs source + github_pr activity`).

---

## Task 7: Reviews/mentions source + `github_review` kind + subscriber

**Files:** analogous (`reviews-source.ts`, `github-review-subscriber/`, tests) + shared-file additions.

**Interfaces:**
- `GitHubReviewPayload = { repo: string; prNumber: number; kind: 'requested' | 'reviewed' | 'commented' | 'mentioned'; url: string; updatedAt: string }`; event `'github.review'`; kind `github_review`.
- `GitHubReviewsSource` (`source = 'reviews'`), cursor = ISO ts. `enabled = githubConnected && githubTrackingEnabled`.
  - `poll(null)`: return `now`, emit nothing.
  - `poll(cursor)`: two calls — (a) `GET /search/issues?q=is:pr+review-requested:@me+updated:>=<cursor>` → emit `kind:'requested'` per item; (b) `GET /notifications?since=<cursor>&all=false` → for each notification with `reason in ('review_requested','mention','comment')` and `subject.type === 'PullRequest'`, map reason→kind (`review_requested`→`requested`, `mention`→`mentioned`, `comment`→`commented`), derive `repo` from `n.repository.full_name`, `prNumber` from `subject.url` tail, `url: subject.url`, `updatedAt: n.updated_at`. Emit `github.review`. Return the max `updated_at` across both (or `cursor`). Dedupe by `(repo, prNumber, kind, updatedAt)`.

- [ ] Steps mirror Task 5/6. Commit (`feat(sync): GitHub reviews source + github_review activity`).

---

## Task 8: Wire pollers + subscribers into the app lifecycle

**Files:**
- Modify: `app/src/main/index.ts` (construct `GitHubAuth` singleton + 3 `SourcePoller`s; start/stop alongside the Google pollers)
- Modify: `app/src/main/activity/index.ts` (start/stop the 3 GitHub subscribers alongside the Google subscribers)
- Modify: `app/src/main/ipc/auth.ts` (add `github:connect` → `githubAuth.authorizeDeviceFlow()` + `settingsRepo.update({ githubConnected: true })` + `syncCursors.clear('github')`; `github:disconnect` → `githubAuth.disconnect()` + `githubConnected: false` + `syncCursors.clear('github')`), mirroring the `google:connect`/`google:disconnect` handlers.
- No new test file; verify by `typecheck` + `lint` + full suite green.

**Interfaces:** Preflight `() => githubAuth.isAuthorized()`. Poll intervals: commits/PRs 5 min, reviews 5 min. Construct a single `GitHubClient({ get token() { return githubAuth.token; } })` shared by the three sources.

- [ ] **Step 1:** Load saved GitHub creds on boot (mirror `void googleAuth.loadSavedCredentials()`). Construct `GitHubAuth` + `GitHubClient` + the 3 sources + 3 `SourcePoller`s in `main/index.ts`; start/stop.
- [ ] **Step 2:** Start/stop the 3 subscribers in `activity/index.ts`.
- [ ] **Step 3:** Add the two IPC handlers.
- [ ] **Step 4: Verify** typecheck + lint + full suite green. **Commit** (`feat: wire GitHub pollers, subscribers, and connect IPC`).

---

## Task 9 (DEFERRABLE UI): Connect + repo-picker + settings UI

**Files:** `app/src/renderer/overlay/steps/StepConnect/StepConnect.tsx` (GitHub connect button — replace the "coming soon" line), a repo-picker (fetch the user's repos via a new `github:listRepos` IPC → `GET /user/repos?per_page=100&sort=updated`), and the Settings page (toggle + watched-repo management + last-sync). Exempt from TDD; verify via typecheck + lint + a manual `pnpm dev` pass by the user.

> Mirror the Phase-1 decision: this UI task is **optional/last** and may be deferred. The backend is fully functional without it once `github:connect` exists (Task 8) — connecting drives the connectors; `githubTrackingEnabled` defaults on; `githubWatchedRepos` can be seeded via the picker or settings.

- [ ] Connect button → `github:connect` IPC; on success show connected state + repo picker.
- [ ] Repo picker persists selections to `githubWatchedRepos`.
- [ ] Settings: toggle + watched-repo list + last-sync time.
- [ ] Verify typecheck + lint; ask the user to confirm visually. Commit.

---

## Final verification

- [ ] `pnpm --filter ./app run typecheck && pnpm --filter ./app run lint && pnpm --filter ./app exec vitest run` — all green.
- [ ] Manual: connect GitHub (dev), confirm first sync writes cursors but no backlog activity; push a commit / open a PR / request a review, confirm the next poll writes exactly the new diffs.

## Self-review notes (author)

- Spec coverage: allowlist→T1; auth→T2; client→T3; settings→T4; commits→T5; PRs→T6; reviews→T7; wiring+IPC→T8; UI→T9 (deferrable). Rate-limit/ETag handling lives in the client (T3) + `since`/`updated:>=` cursors per source.
- Type consistency: every source implements the Phase-1 `ContextSource` seam (`poll(cursor: string | null): Promise<string>`); the commits JSON-map cursor is still a `string`. Payload/schema/subscriber/gate names match per section.
- No-new-dep constraint honored (native `fetch`); allowlist extended; tokens in keytar only; first-snapshot no-backlog enforced in every source.
- Known carry-over limitations from Phase 1 apply here too and are acceptable follow-ups: no multi-page pagination beyond the first page/`per_page` window (documented), and the allowlist helper is still not wired into the transport (the GitHub client calls `assertAllowedHost` itself, which actually *does* wire it for GitHub traffic — a small improvement over Phase 1).

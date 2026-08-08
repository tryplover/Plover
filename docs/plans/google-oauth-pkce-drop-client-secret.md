# Google OAuth PKCE — Drop the Shipped Client Secret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app's Google OAuth loopback flow to PKCE so `GOOGLE_CLIENT_SECRET` no longer ships inside the distributed Electron app, while keeping all Google API data reads client-side (local-first / privacy-by-design preserved).

**Architecture:** The app already runs the OAuth loopback flow entirely in the main process (`app/src/main/sync/google-auth.ts`): it starts a `127.0.0.1` HTTP server, opens the system browser, receives the auth code, and exchanges it for tokens via `google-auth-library`. Today that exchange authenticates with an embedded `CLIENT_SECRET` — a confidential developer secret leaking into every build. We switch the GCP OAuth client to type **Desktop app** and add PKCE (`code_challenge`/`code_verifier`), which lets Google's token endpoint accept the exchange with **no client secret**. Google API reads (Gmail/Calendar/Classroom/Drive/Docs) stay exactly where they are — this plan does not touch `sync/google/*` sources or the backend.

**Tech Stack:** TypeScript (Electron main), `google-auth-library` / `googleapis`, `keytar`, Vitest.

## Global Constraints

- **Local-only data.** No Google user data may transit plover-server. This plan keeps all reads client-side. (CLAUDE.md hard constraint.)
- **TypeScript strict** with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Do not loosen.
- **No new deps.** PKCE ships inside `google-auth-library`, already a dependency.
- **No comments** unless the WHY is non-obvious.
- **No real network in tests.** Mock the OAuth2 client.
- Verification gate: `pnpm typecheck && pnpm lint && pnpm test` green from repo root.
- Outbound allowlist already includes `oauth2.googleapis.com` and `accounts.google.com` — no allowlist change needed.

---

### Task 1: Add PKCE to `GoogleAuth.authorize()` and drop the client secret

**Files:**
- Modify: `app/src/main/sync/google-auth.ts`
- Test: `app/tests/sync/google-auth.test.ts` (Create — no test exists today)

**Context on the current code (read before editing):**
- Lines 10–12 read `CLIENT_ID` (devFallback `mock-client-id`) and `CLIENT_SECRET` (devFallback `mock-client-secret`) via `resolveRequiredEnv`.
- Line 45 (constructor) builds `new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost')`.
- Line 92 (inside `authorize()`) builds a second client `new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri)`, calls `client.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_API_SCOPES, prompt: 'consent', state: expectedState })`, then on redirect `const { tokens } = await client.getToken(code)`.

**Interfaces:**
- Consumes: `google-auth-library`'s `OAuth2Client` — `oauth2Client.generateCodeVerifierAsync(): Promise<{ codeVerifier: string; codeChallenge: string }>`, `generateAuthUrl(opts)` accepting `code_challenge_method` + `code_challenge`, and `getToken({ code, codeVerifier }): Promise<{ tokens }>`.
- Produces: unchanged public API — `GoogleAuth` class with `authorize()`, `loadSavedCredentials()`, `disconnect()`, `isAuthorized()`, `client`, and exported `GOOGLE_API_SCOPES`. No caller changes downstream.

- [ ] **Step 1: Write the failing test**

Create `app/tests/sync/google-auth.test.ts`. Mock `google-auth-library`'s OAuth2 client so no network/browser is touched, and assert PKCE is wired and no secret is passed. Mock `keytar`, `electron` (`shell.openExternal`), and drive one fake redirect through the loopback server.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateAuthUrl = vi.fn(() => 'https://accounts.google.com/o/oauth2/auth?fake');
const getToken = vi.fn(async () => ({ tokens: { refresh_token: 'rt', access_token: 'at' } }));
const setCredentials = vi.fn();
const generateCodeVerifierAsync = vi.fn(async () => ({
  codeVerifier: 'verifier-123',
  codeChallenge: 'challenge-abc',
}));
const OAuth2 = vi.fn(function (this: Record<string, unknown>) {
  this.generateAuthUrl = generateAuthUrl;
  this.getToken = getToken;
  this.setCredentials = setCredentials;
  this.generateCodeVerifierAsync = generateCodeVerifierAsync;
  this.credentials = {};
});

vi.mock('googleapis', () => ({ google: { auth: { OAuth2 } } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: OAuth2 }));
vi.mock('keytar', () => ({
  default: { setPassword: vi.fn(), getPassword: vi.fn(), deletePassword: vi.fn() },
}));

let capturedAuthUrl = '';
vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn(async (url: string) => {
      capturedAuthUrl = url;
    }),
  },
}));

describe('GoogleAuth PKCE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAuthUrl = '';
  });

  it('constructs the OAuth client without a client secret', async () => {
    const { GoogleAuth } = await import('../../src/main/sync/google-auth.js');
    new GoogleAuth();
    // clientSecret arg (2nd positional) must be undefined/absent.
    const firstCallArgs = OAuth2.mock.calls[0] ?? [];
    expect(firstCallArgs[1]).toBeUndefined();
  });

  it('requests a PKCE code_challenge in the auth URL', async () => {
    const { GoogleAuth } = await import('../../src/main/sync/google-auth.js');
    const auth = new GoogleAuth();
    void auth.authorize();
    await vi.waitFor(() => expect(generateAuthUrl).toHaveBeenCalled());
    const opts = generateAuthUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(opts.code_challenge).toBe('challenge-abc');
    expect(opts.code_challenge_method).toBe('S256');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/sync/google-auth.test.ts`
Expected: FAIL — `generateCodeVerifierAsync` not called / `code_challenge` undefined / secret still passed.

- [ ] **Step 3: Implement PKCE and remove the secret**

In `app/src/main/sync/google-auth.ts`:
- Delete the `CLIENT_SECRET` constant (lines 11–13).
- Constructor (line 45): `this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, undefined, 'http://localhost');`
- Inside `authorize()`, replace the client construction + auth-URL + token-exchange block:

```typescript
const client = new google.auth.OAuth2(CLIENT_ID, undefined, redirectUri);
const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();

const authUrl = client.generateAuthUrl({
  access_type: 'offline',
  scope: GOOGLE_API_SCOPES,
  prompt: 'consent',
  state: expectedState,
  code_challenge_method: 'S256' as never,
  code_challenge: codeChallenge,
});
```

- At the redirect handler, change the exchange to pass the verifier:

```typescript
const { tokens } = await client.getToken({ code, codeVerifier });
```

Note: `code_challenge_method` typing in `generateAuthUrl` uses the library's `CodeChallengeMethod` enum. Prefer importing it: `import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';` and use `CodeChallengeMethod.S256`. If the enum import complicates the mock, the string literal with a cast is acceptable — match whichever keeps typecheck + the test green.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./app exec vitest run tests/sync/google-auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint the file's package**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors referencing `google-auth.ts` or the new test.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/sync/google-auth.ts app/tests/sync/google-auth.test.ts
git commit -m "feat(auth): use PKCE for Google OAuth, drop shipped client secret"
```

---

### Task 2: Remove `GOOGLE_CLIENT_SECRET` from env config and setup docs

**Files:**
- Modify: `docs/RUNNING.md:79` (the "Copy the client ID and secret into `app/.env`" step)
- Modify: `app/.env.example` if present (grep first)
- Modify: any `.env` documentation / `env.d.ts` reference to `GOOGLE_CLIENT_SECRET`

**Interfaces:**
- Consumes: nothing new.
- Produces: setup instructions that create a **Desktop app** OAuth client (not "Web application") and never mention a client secret.

- [ ] **Step 1: Find every remaining reference**

Run: `grep -rn "GOOGLE_CLIENT_SECRET\|client secret\|Web application" docs/ app/ --include='*.md' --include='*.ts' --include='*.example' | grep -iv node_modules`
Expected: `docs/RUNNING.md:79` and possibly `.env.example`. (Task 1 already removed the code reference.)

- [ ] **Step 2: Update `docs/RUNNING.md`**

Change the OAuth setup section so it instructs:
- Create an OAuth client of type **Desktop app** (not Web application).
- Copy only the client ID into `app/.env` as `GOOGLE_CLIENT_ID`.
- Delete the sentence about `GOOGLE_CLIENT_SECRET`.
- Add a one-line note: "Plover uses PKCE for the desktop OAuth flow, so no client secret is embedded in the app."

- [ ] **Step 3: Update `.env.example` (only if the grep found it)**

Remove the `GOOGLE_CLIENT_SECRET=` line. Leave `GOOGLE_CLIENT_ID=`.

- [ ] **Step 4: Verify no dangling references**

Run: `grep -rn "GOOGLE_CLIENT_SECRET" app/ docs/ | grep -iv node_modules`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/RUNNING.md app/.env.example
git commit -m "docs(auth): switch Google OAuth setup to Desktop-app + PKCE, drop client secret"
```

---

### Task 3: Full-suite verification + capture the GCP console step

**Files:**
- Modify: the `plover-auth` skill under `.claude/skills/plover-auth/` (footgun capture per CLAUDE.md contract) — OR `plover-env-and-backend` if that's where the OAuth-client-type footgun best fits.

- [ ] **Step 1: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 2: Capture the manual GCP step as a footgun**

This change requires a **manual GCP console action** that code cannot do: the existing OAuth client is type "Web application" and must be recreated (or a new one created) as type **Desktop app**, otherwise Google's token endpoint rejects the secret-less PKCE exchange with `invalid_request` / `client_secret is missing`. Add a Quick-reference row + Details entry to the relevant `plover-*` skill: symptom (`invalid_client` / missing client_secret on token exchange), root cause (OAuth client is Web-app type, not Desktop), fix (recreate as Desktop app, update `GOOGLE_CLIENT_ID`).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/
git commit -m "docs(skill): capture Desktop-app OAuth-client-type requirement for PKCE flow"
```

---

## Self-Review

- **Spec coverage:** Drop shipped secret (Task 1), remove it from config/docs (Task 2), keep data reads client-side (no `sync/google/*` changes anywhere in plan ✓), capture manual GCP step (Task 3). Covered.
- **Placeholder scan:** No TBD/"handle errors" placeholders; all code steps show concrete edits.
- **Type consistency:** `authorize()`, `GOOGLE_API_SCOPES`, and the `GoogleAuth` public surface are unchanged, so no downstream caller (`ipc/auth.ts:7,87`, `gdocs-poller.ts`) needs edits. PKCE method uses the library's `CodeChallengeMethod.S256` (or `'S256'` literal fallback).
- **Manual dependency called out:** GCP OAuth client must be Desktop-app type — flagged in Task 3, not silently assumed.

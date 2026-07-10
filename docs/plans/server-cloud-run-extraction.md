# Plan — extract server to plover-server on Cloud Run

Design: [docs/superpowers/specs/2026-07-10-server-cloud-run-extraction-design.md](../superpowers/specs/2026-07-10-server-cloud-run-extraction-design.md).

## Prerequisites (manual, blocks code)

Code cannot start until the user has done these — the Electron build needs the Cloud Run URL and the server code needs the OAuth client IDs. Setup guide lives inline in the chat that produced this plan; a permanent copy also lives at the top of `plover-server/README.md` (created by task S-1 below).

1. GCP project created; Cloud Run, Firestore (Native), Artifact Registry, Secret Manager, IAM APIs enabled.
2. Firestore database created in Native mode, `us-central1`.
3. Two Google OAuth 2.0 clients created in `APIs & Services → Credentials`:
   - `plover-server` (Web application). Redirect URI: `https://<cloud-run-url>/oauth/callback`. Note client ID + secret.
   - `plover-app` (Desktop) already exists.
4. `gemini-api-key` and `oauth-secret` created in Secret Manager.
5. Service account `plover-server-deploy@<project>.iam.gserviceaccount.com` created with `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`.
6. Runtime service account `plover-server-runtime@<project>.iam.gserviceaccount.com` created with `roles/datastore.user`, `roles/secretmanager.secretAccessor`.
7. Workload Identity Federation pool + provider bound to the GitHub repo `<org>/plover-server`.
8. Empty GitHub repo `plover-server` created on the same org as Plover.
9. First `gcloud run deploy` (empty container) run manually to obtain the Cloud Run URL.
10. User provides: `PLOVER_BACKEND_URL`, `GOOGLE_OAUTH_CLIENT_ID_SERVER`, GCP project ID, WIF provider resource name.

## Milestones

Three milestones, executed in order. Each ends in green tests.

### Milestone A — `plover-server` skeleton + moved routes

Independent tasks (Haiku subagents in parallel worktrees under the new repo):

- **S-1: Repo bootstrap.** `pnpm init`, `tsconfig.json` (strict, ESM, target Node 22), Dockerfile (multi-stage, alpine-node:22), `.dockerignore`, `.gcloudignore`, `cloudrun.yaml`, `.env.example`, `README.md` with the setup guide + local dev instructions. Copy `.editorconfig` + Prettier + ESLint config from Plover for consistency.
- **S-2: Move existing server code.** Copy `server/src/{index,app,gemini-config,load-env}.ts` verbatim. Copy dependencies from `server/package.json` into new `package.json`. Copy any existing tests. Confirm `pnpm test` green in the new repo.
- **S-3: Split monolithic `app.ts` into per-route files.** Extract each `app.post('/api/...')` handler into `src/routes/<name>.ts` exporting an Express `Router`. Move shared helpers (`sanitizeString`, `FALLBACK_MODELS`, prompt builders) into `src/shared/`. `app.ts` becomes ~40 lines wiring routers + middleware. **Do not change endpoint request/response shapes.** Verify with the existing route tests.
- **S-4: `.github/workflows/deploy.yml`** — build + push to Artifact Registry, `gcloud run deploy`. WIF auth. Deploy on push to `main`. No secrets in workflow.

Verification for A: `pnpm test` green, `docker build .` succeeds, first push to `main` results in a deployed 200 on `/health`.

### Milestone B — Auth on the server

Independent tasks in the new repo:

- **B-1: Firestore client singleton.** `src/firestore/client.ts` exports `getFirestore()` using `@google-cloud/firestore` with default IAM (runtime service account). No explicit credentials in code.
- **B-2: `auth/tokens.ts`.** `generateToken()` returns 32 crypto-random bytes as base64url. `hashToken(raw)` returns SHA-256 hex. `storeToken(userId, raw)`, `lookupToken(raw) → { userId, revoked }`, `revokeToken(hash)`.
- **B-3: `auth/state-store.ts`.** In-memory `Map<nonce, { createdAt }>` with 10-minute TTL. Small enough for Cloud Run single-instance; not persisted across cold starts (that's fine — nonce lifetime is a single browser tab).
- **B-4: `auth/signup.ts`.** Two routes:
  - `GET /signup?state=<nonce>` → renders a minimal HTML page (single template literal, no framework) with a "Continue with Google" link that hits Google's OAuth authorize URL. `state` from the query param is passed through.
  - `GET /oauth/callback?code=...&state=...` → exchanges the code with the server OAuth client, verifies the `id_token`, upserts `users/{googleSub}`, generates a token, stores its hash, 302s to `plover://auth?token=<raw>&state=<nonce>`.
- **B-5: `auth/middleware.ts`.** Reads `X-Plover-Auth-Token`, calls `lookupToken`, attaches `req.userId`, 401 on miss or revoke.
- **B-6: `firestore/rate-limit.ts` + middleware.** `increment(userId, routeGroup)` uses Firestore transactions for atomicity. Middleware factory `rateLimitFor(routeGroup, dailyMax)` returns an Express middleware; each route wires its own factory call in `src/routes/*.ts`.
- **B-7: Apply middleware.** Update `app.ts` to mount `authMiddleware` + per-route rate limiters before the four API routes. `/health`, `/signup`, `/oauth/callback` remain unauthenticated.

Verification for B: unit tests for tokens (hash determinism, generation entropy), signup (mocked Google id_token, state round-trip), middleware (401 on missing/invalid/revoked, 200 pass-through), rate-limit (concurrent increments in a Firestore emulator).

### Milestone C — Electron app changes

Independent tasks in this repo (worktrees per task):

- **C-1: Delete `server/` and update workspace.** Remove `server/` directory, remove `server` from `pnpm-workspace.yaml`, drop root scripts that filter `--filter ./server`. `pnpm install` clean.
- **C-2: `app/electron.vite.config.ts` bake `PLOVER_BACKEND_URL`.** Add `define` block. Keep existing runtime `process.env.PLOVER_BACKEND_URL` fallback so power users can override.
- **C-3: `app/src/main/auth/plover-token.ts`.** Thin wrapper around `keytar` for get/set/clear on `plover_token`. Mirror the pattern in the existing `google-auth.ts` keytar usage; do NOT invent a new keychain service name — reuse the `plover` service with account `plover_token`.
- **C-4: `app/src/main/auth/signup-flow.ts`.** `startSignup(): Promise<string>`:
  1. Generate 32-byte nonce, hold in-memory map.
  2. `shell.openExternal(`${BACKEND_URL}/signup?state=<nonce>`)`.
  3. Await `plover://auth` deep link via the protocol handler (see C-5).
  4. Validate incoming state matches; reject if not.
  5. `keytar.setPassword('plover', 'plover_token', <raw>)`.
  6. Drop nonce, resolve promise.
- **C-5: `app/src/main/ipc.ts` protocol registration.** `app.setAsDefaultProtocolClient('plover')`. Listen for `open-url` (macOS) and `second-instance` (Windows/Linux — deferred, but wire the listener). On event, parse `plover://auth?token=...&state=...` and hand to `signup-flow.ts`.
- **C-6: `app/src/main/index.ts` boot gate.** On `app.ready`, check `keytar` for `plover_token`. If present, load main window as usual. If missing, load `SignupScreen` (renderer route `?variant=signup`).
- **C-7: `app/src/renderer/setup/SignupScreen.tsx`.** Reuse existing overlay component library. Single "Continue with Google" button that invokes an IPC channel `signup:start`. Status states: idle / opened-browser / waiting-callback / success / error.
- **C-8: Attach `X-Plover-Auth-Token` header on all backend calls.** Every existing fetch in `app/src/main/planner/decompose.ts`, `app/src/main/activity/{screen-capturer,inference,git-commit-tracker}.ts` gains a shared helper `authedFetch(path, init)` in `app/src/main/http/authed-fetch.ts` that pulls the token from keytar and adds the header. On 401, clear the token and re-open signup.
- **C-9: `docs/RUNNING.md` update.** New section: "Signing in", "Running against the deployed server", "Running with a local plover-server", and the `plover://` protocol registration caveat for dev.
- **C-10: Diagram regen.** Regenerate `docs/diagrams/core-architecture.svg` and `docs/diagrams/seq-diagram.svg` from updated mermaid sources (commit `.mmd` files alongside).

Verification for C: `pnpm typecheck && pnpm lint && pnpm test` at the repo root. New tests: `signup-flow.test.ts` (mocked `shell.openExternal`, simulated deep link, state validation), `plover-token.test.ts` (keytar mock), `authed-fetch.test.ts` (header presence, 401 → signup handoff).

## Dispatch strategy

Milestone A → B → C is strictly sequential. Within each milestone, tasks flagged as **Independent** run in parallel via Haiku subagents in worktrees. Orchestrator reviews each diff before the next task lands.

- Independent in A: S-1 || S-2 (S-3, S-4 depend on both)
- Independent in B: B-1 || B-2 || B-3 (B-4 needs B-2 + B-3; B-5 needs B-2; B-6 needs B-1; B-7 barrier at end)
- Independent in C: C-1 || C-2 || C-3 (C-4 needs C-3; C-5 needs C-4; C-6/7 need C-5; C-8 can run parallel to C-4..7; C-9 + C-10 last)

## Verification gates

- End of A: hitting `https://<cloud-run-url>/health` returns 200. Existing endpoints return 401 without a bearer, 200 with a manually-inserted Firestore token.
- End of B: full signup round-trip works in a browser — visit `/signup?state=test`, click through Google consent, redirect lands on `plover://auth?...` (browser will show "cannot open URL" — that's fine, we're not testing the app yet).
- End of C: DMG packaged with the Cloud Run URL baked in. Fresh install on a clean macOS user account: signup completes, "Today" screen appears, goal decomposition works, screen inference works.

Full stack: `pnpm typecheck && pnpm lint && pnpm test` in both repos, both green.

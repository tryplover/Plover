# Server extraction to Cloud Run — design

> Status: approved 2026-07-10. Implementation plan: [docs/plans/server-cloud-run-extraction.md](../../plans/server-cloud-run-extraction.md).

## Goal

Split the Express server currently in `server/` into its own repo, deploy to Google Cloud Run behind Google Sign-In per-user tokens, and have the Electron app forward all Gemini traffic to the hosted URL. End users download the DMG, sign in once with Google, and everything works — no local backend, no exposed API keys.

## Non-goals

- No staging environment. One Cloud Run service, one URL.
- No email/password auth. Google Sign-In only.
- No canary/blue-green rollouts. Cloud Run's default rollout is enough.
- No structured-logs pipeline. Cloud Logging default; Sentry only if the demo breaks.
- No email verification / ToS in the signup flow.

## Topology

```
┌─────────────────────────┐                       ┌──────────────────────────┐
│  User's machine         │                       │  Google Cloud (your GCP) │
│  ┌───────────────────┐  │  HTTPS + token        │  ┌────────────────────┐  │
│  │  Plover.app       │──┼──────────────────────>│  │  Cloud Run:        │  │
│  │  (Electron)       │  │  X-Plover-Auth-Token  │  │  plover-server     │  │
│  │  keytar stores:   │  │                       │  │  (Express + Docker)│  │
│  │   - plover_token  │  │                       │  └─────────┬──────────┘  │
│  │   - google_oauth  │  │                       │            │             │
│  └────────┬──────────┘  │                       │            ├── Firestore │
│           │  plover://  │                       │            │             │
│           │  deep link  │                       │            └── Gemini API│
└───────────┼─────────────┘                       └──────────────────────────┘
            ▲
            │  redirect
    ┌───────┴───────┐
    │  Chrome/Safari│    Sign-in page
    │  signup flow  │◄── https://plover-server-xxxx.run.app/signup
    └───────────────┘
```

**Two repos.** `plover` (Electron app only, no more `server/`) and `plover-server` (Express + Dockerfile + GitHub Actions).

**Two data stores.** User machine: `keytar` holds `plover_token`. Server: Firestore holds hashed tokens + per-user rate-limit counters.

**Server-only secrets.** `GEMINI_API_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET` (server web-app client, separate from the app's Calendar desktop client). Firestore auth is via workload identity — no key file.

## Request flow (normal API call)

```
Electron            plover-server            Firestore       Gemini
   │  POST /api/decompose                        │              │
   │  X-Plover-Auth-Token: abc123                │              │
   ├──────────────>  authMiddleware              │              │
   │                 hash(token) → lookup ──────>│              │
   │                 { userId, revoked=false } <─┤              │
   │                 rateLimit.check ───────────>│              │
   │                 counter++ ok <──────────────┤              │
   │                 generateContent(...) ──────────────────────>│
   │                 { functionCalls } <─────────────────────────┤
   │ <────────────── 200 { subtasks }            │              │
```

**Two middleware layers before every handler.**

1. `authMiddleware` — SHA-256 hashes the incoming token, looks up `tokens/{tokenHash}` in Firestore, 401 if missing/revoked, attaches `req.userId`. Tokens are never stored raw — a Firestore leak can't produce usable credentials.
2. `rateLimitMiddleware` — Firestore atomic increment on `rate_limits/{userId}_{routeGroup}_{yyyymmdd}`. Fails **open** on Firestore hiccup for auth-passing users (better than false 429s during Firestore downtime); fails **closed** if auth itself errors.

**Endpoint shapes are unchanged.** `/api/decompose`, `/api/infer-progress`, `/api/match-commit`, `/api/infer-screen` keep their current request/response bodies. The only client-side difference is a new base URL and a `X-Plover-Auth-Token` header.

## Signup flow (first launch)

```
Plover first launch → no plover_token in keytar → SignupScreen
      │
      ├─ generate random 32-byte state, hold in memory
      │
      └─ shell.openExternal(https://plover-server-xxxx.run.app/signup?state=<nonce>)
            │
            └─ Google OAuth consent (scope: openid email)
                  │
                  └─ /oauth/callback
                        │  verify id_token, upsert users/{googleSub}
                        │  generate 32-byte token, store SHA-256 hash in tokens/{hash}
                        │  302 → plover://auth?token=<raw>&state=<nonce>
                        ▼
Electron protocol handler catches plover://auth?...
      │  verify state matches in-memory nonce (mitm defense)
      │  keytar.setPassword('plover_token', <raw>)
      │  drop nonce
      │  load main window
```

**The `state` nonce is load-bearing.** Without it, a malicious `plover://auth?token=attacker_token` link steals the account of anyone who clicks it. The Electron protocol handler MUST reject any callback whose state doesn't match the one it just issued.

**Two separate OAuth clients.**
- `plover-server` — web application type, scopes `openid email`, only for signup identity.
- `plover-app` (existing) — desktop app type, scopes for Calendar. Tokens live in `keytar`.
A compromise of one does not grant access via the other.

**Custom-protocol registration in dev.** macOS routes `plover://` to the last-launched app bundle. Dev iteration on the signup flow requires running the packaged build once so the OS registers this dev instance as the `plover://` handler. Documented in `docs/RUNNING.md`.

## Firestore schema

```
users/{googleSub}
  email: string
  createdAt: timestamp

tokens/{sha256(token)}       # doc id is the hash; raw token is never persisted
  userId: string             # = googleSub
  createdAt: timestamp
  revokedAt: timestamp?      # null when active
  lastUsedAt: timestamp

rate_limits/{userId}_{routeGroup}_{yyyymmdd}
  count: number
  updatedAt: timestamp
```

`routeGroup` values: `decompose`, `infer-progress`, `match-commit`, `infer-screen`. Each has its own daily quota. Initial quotas (tunable in code, not per-user): 200/day for cheap endpoints, 30/day for `infer-screen` (Gemini vision cost dominates).

## Repo layout

### `plover-server` (new)

```
plover-server/
├── .github/workflows/deploy.yml     # push to main → Cloud Run
├── Dockerfile                       # multi-stage: build → slim runtime
├── .dockerignore
├── cloudrun.yaml                    # service config
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts                     # bootstrap (unchanged shape)
    ├── app.ts                       # thin Express wiring
    ├── load-env.ts
    ├── gemini-config.ts
    ├── auth/
    │   ├── middleware.ts
    │   ├── signup.ts                # /signup + /oauth/callback
    │   ├── tokens.ts                # hash, generate, store, revoke
    │   └── state-store.ts           # short-lived signup nonces
    ├── firestore/
    │   ├── client.ts                # singleton client
    │   └── rate-limit.ts            # atomic increment
    └── routes/
        ├── decompose.ts             # split out of monolithic app.ts
        ├── infer-progress.ts
        ├── match-commit.ts
        └── infer-screen.ts
```

**Splitting `app.ts` (currently 671 lines) into per-route files is a targeted improvement, not scope creep.** Adding auth + signup on top of a monolithic file makes it unreviewable.

### `plover` (this repo) — changes

- `pnpm-workspace.yaml` — remove `server` from packages.
- `package.json` — drop root scripts that call the server workspace.
- `docs/RUNNING.md` — point to the `plover-server` repo for local backend + note the `plover://` protocol registration caveat.
- `app/electron.vite.config.ts` — add `define` that bakes `PLOVER_BACKEND_URL` from `process.env` at build time.
- `app/src/main/auth/plover-token.ts` (new) — keytar wrapper for `plover_token`.
- `app/src/main/auth/signup-flow.ts` (new) — open browser + protocol handler + nonce.
- `app/src/main/ipc.ts` — register `plover://` handler on `app.ready`.
- `app/src/main/index.ts` — at boot, check `plover_token`; if missing, show signup screen before main window loads.
- `app/src/main/planner/decompose.ts` + `app/src/main/activity/*.ts` — attach `X-Plover-Auth-Token` header on every fetch.
- `app/src/renderer/setup/SignupScreen.tsx` (new) — "Continue with Google" button + status.
- Delete `server/` directory.

## Config wiring

`electron.vite.config.ts`:

```ts
define: {
  'import.meta.env.PLOVER_BACKEND_URL':
    JSON.stringify(process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000'),
}
```

- **Dev** (`pnpm dev`): env unset → falls back to `http://localhost:3000` → developer runs `plover-server` locally alongside.
- **Release build** (`PLOVER_BACKEND_URL=https://plover-server-xxxx.run.app pnpm package`): URL is inlined into the compiled main-process bundle.
- **Escape hatch**: runtime code stays `process.env.PLOVER_BACKEND_URL ?? BAKED_URL` — power users can self-host.

## Deploy pipeline

`.github/workflows/deploy.yml` in `plover-server`:

- Trigger: push to `main`.
- Auth: Workload Identity Federation. GitHub OIDC token → GCP service account with `roles/run.admin` + `roles/artifactregistry.writer`. **No long-lived JSON key in GitHub Secrets.**
- Build: `gcloud builds submit` → Artifact Registry image.
- Deploy: `gcloud run deploy plover-server --region us-central1 --min-instances 0 --max-instances 3 --memory 512Mi --cpu 1 --timeout 60s`.
- Secrets: `--set-secrets GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_OAUTH_CLIENT_SECRET=oauth-secret:latest` — pulled from Secret Manager at runtime, never in env files.

## Error handling

| Failure                           | Response       | Client behavior                        |
| --------------------------------- | -------------- | -------------------------------------- |
| Missing / invalid token           | 401            | Show re-signup screen                  |
| Rate limit exceeded (per-user)    | 429 + Retry-After | Toast "slow down"                   |
| Gemini 429 / 5xx (all fallbacks)  | 502            | Toast + queue retry                    |
| Firestore timeout on auth         | 200 (fail open) | Sentry log; user unaffected           |
| Firestore timeout on rate limit   | 429 (fail closed) | Better than accidental unlimited     |
| plover:// callback with bad state | Silent reject  | Signup screen stays; user tries again  |

## Testing

- **Server**: existing route tests keep working (endpoint shapes unchanged). Add `auth/middleware.test.ts` (token hash + Firestore mock), `auth/signup.test.ts` (OAuth callback with fake id_token, state round-trip), `firestore/rate-limit.test.ts` (concurrent increments).
- **Client**: `auth/signup-flow.test.ts` mocks `shell.openExternal` and simulates `plover://` deep-link arrival with correct/incorrect state. `auth/plover-token.test.ts` uses the same keytar mock pattern the Google-auth tests already use.
- **No real network in tests.** Nock recordings for Gemini + Google OAuth token verification.

## Diagrams

Existing `docs/diagrams/core-architecture.svg` and `docs/diagrams/seq-diagram.svg` are regenerated to reflect the split. Mermaid source is committed alongside each SVG so future edits don't require reverse-engineering.

## Out of scope for this spec (deferred)

- Token rotation / expiry (tokens are long-lived; user revokes by re-signup).
- Admin UI for the plover-server operator.
- Multi-user Firestore isolation beyond `userId` doc keys.
- Cost dashboards + billing alerts (documented as a manual step, not in code).

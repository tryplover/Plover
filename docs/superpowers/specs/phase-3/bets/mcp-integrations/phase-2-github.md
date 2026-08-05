# MCP - Phase 2: GitHub (diffs since snapshot)

Add a GitHub connector that tracks **only new diffs since the last snapshot** —
commits, pull requests, and reviews/comments directed at the user — and feeds them
into the activity stream.

Read [./overview.md](./overview.md) first — connector architecture, `sync_cursors`,
and constraints are defined there.

## Scope

In scope (read/context only):

- **Commits** — new commits pushed to tracked repos/branches since the snapshot.
  This is the GitHub-API analog of the existing local `git-commit-tracker`.
- **Pull requests** — PRs involving the user that changed since the snapshot:
  opened, merged, closed, review-requested, status/CI changes.
- **Reviews + comments** — review requests, reviews, and comments/@-mentions
  directed at the user.

Out of scope: issues (deferred — not selected), write-back (opening PRs/issues,
commenting), full diff bodies (store metadata + counts, not patches).

## Auth

New provider auth `app/src/main/sync/github-auth.ts`, mirroring `google-auth.ts`:

- **GitHub OAuth** via the loopback desktop flow (OAuth App), or **device flow** if
  loopback registration is inconvenient — pick device flow if we cannot register a
  redirect (it needs no redirect URI). Scopes: `repo` (or `public_repo` if we only
  ever watch public repos) and `read:user`. Prefer the narrowest that still returns
  the user's PRs/reviews across their repos.
- Store the access token in **keytar** (service `plover`, account
  `github-access-token`). GitHub OAuth tokens don't expire by default; no refresh
  handling needed unless we adopt a GitHub App (out of scope).
- Client id/secret from env with dev fallbacks, matching the Google env pattern
  (`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`).

## Repo selection

The user picks which repos to watch (avoids polling every repo they can see).
Persist the selected repo full-names in `settings` (`githubWatchedRepos: string[]`).
A "watch all my repos" option is allowed but off by default.

## Per-source diff mechanism

| Source | Cursor (`sync_cursors.source`) | Fetch since cursor | First-snapshot behavior |
|--------|-------------------------------|--------------------|-------------------------|
| Commits | source `commits` → per-repo ISO ts (JSON map) | `GET /repos/{o}/{r}/commits?since=<ts>&sha=<branch>` per watched repo | Record `now` per repo, emit nothing |
| PRs | source `prs` → ISO ts | Search: `GET /search/issues?q=is:pr involves:@me updated:>=<ts>` | Record `now`, emit nothing |
| Reviews/comments | source `reviews` → ISO ts | Search `review-requested:@me updated:>=<ts>` + notifications `GET /notifications?since=<ts>` filtered to review/mention reasons | Record `now`, emit nothing |

Use conditional requests (`If-Modified-Since` / ETag) where the endpoint supports it
to stay under rate limits; store the ETag alongside the ts if useful. Dedupe by
`(type, id, updated_at)`.

## Activity kinds + events

Add to `activity-types.ts` (zod schema each) + event bus:

| `activity.kind` | Bus event | Payload (minimal) |
|-----------------|-----------|-------------------|
| `github_commit` | `github.commit` | `{ repo, sha, message, author, url, committedAt }` |
| `github_pr` | `github.pr` | `{ repo, number, title, state, action, url, updatedAt }` |
| `github_review` | `github.review` | `{ repo, prNumber, kind: 'requested'\|'reviewed'\|'commented'\|'mentioned', url, updatedAt }` |

## Store / settings

- `sync_cursors` rows: `github/commits`, `github/prs`, `github/reviews`.
- `settings`: `githubConnected` flag; `githubTrackingEnabled` toggle;
  `githubWatchedRepos` selection.

## UI

- Replace the GitHub "coming soon" placeholder in `StepConnect.tsx` with a connect
  button + repo picker.
- Settings: toggle, watched-repo management, last-sync time.

## Subtasks (`MCP - Phase 2`)

1. `MCP - Phase 2` — `github-auth.ts` OAuth (device or loopback) + keytar token storage.
2. `MCP - Phase 2` — Repo selection (fetch user repos) + `githubWatchedRepos` settings.
3. `MCP - Phase 2` — Commits connector (`since` per repo) + `github_commit` kind/schema/subscriber.
4. `MCP - Phase 2` — PR connector (search `involves:@me updated:>=`) + `github_pr` kind/schema/subscriber.
5. `MCP - Phase 2` — Reviews/comments connector (review-requested + notifications) + `github_review` kind/schema/subscriber.
6. `MCP - Phase 2` — Wire Inference to consume the new kinds; connect UI + settings.

## Testing

- TDD diff/cursor logic (first-snapshot, dedupe, per-repo commit cursors, ETag
  handling). `nock` fixtures for the REST + search endpoints. No real network.

## Acceptance

1. Connect + pick repos; first sync emits no backlog.
2. Subsequent polls emit only commits/PRs/reviews changed since the cursor.
3. Access token in keytar only; cursors in `sync_cursors`.
4. Rate-limit-aware (conditional requests / backoff); `pnpm typecheck && pnpm lint && pnpm test` clean.

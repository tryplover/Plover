# Feature: GitHub integration (stub)

> Read [../overview.md](../overview.md) first.
>
> **Status:** stub. Expand to a detailed spec before writing its plan.

Connect Plover to GitHub so the agent can:

- read PRs, issues, review requests, and recent commits as **context** for goal decomposition,
- write tasks back as **GitHub issues** (and optionally comments) when the user chooses to share a goal with a repo,
- log GitHub activity into `ActivityRepo` so the inference + nudge engines see what the user is working on across the SDLC.

## Why this exists

The current "GitHub tracker" in the codebase (`app/src/main/activity/git-commit-tracker.ts`) only watches **local git** via `.git/COMMIT_EDITMSG`. It never talks to the GitHub API. That gap means the agent has no visibility into PR review state, issue assignment, or anything that happens off the user's machine.

## Open questions (resolve before plan)

1. **Auth model.** OAuth App vs. GitHub App vs. PAT? OAuth App is simplest but per-user; GitHub App is needed for org-level features. Default assumption: OAuth App via the backend proxy (`/server/`), refresh token in `keytar`.
2. **Scope of read.** Single repo per goal? User's whole "starred-and-recently-contributed-to" set? Org membership scan? Start single-repo for v1.
3. **Write-back semantics.** When pushing a subtask to GitHub as an issue, do we cross-link the issue id back to the task? Yes — `tasks.github_issue_url` column.
4. **Rate limiting.** GitHub REST is 5 000 req/hr authenticated; GraphQL is 5 000 points. Polling cadence needs a budget — propose 1 polling tick per 5 min for active repos, with exponential backoff on `403 X-RateLimit-Remaining=0`.
5. **Activity event taxonomy.** `github_pr_opened`, `github_pr_merged`, `github_review_requested`, `github_issue_assigned`, `github_commit_pushed`? Pick a minimal v1 list.

## Sketch of module additions

- `app/src/main/activity/github-tracker.ts` — periodic poller, write-only to `ActivityRepo`.
- `app/src/main/sync/github.ts` — read + write GitHub API surface (issues, PRs, comments).
- `server/src/github/` — OAuth callback + (optionally) API proxy if we want repos pinned to a server-side IP.
- `store/repos/integrations.ts` — shared across all integrations, holds connection metadata.

## Hard constraints

- Add `api.github.com` and (if proxied) the backend host to the allowlist.
- Tokens in `keytar` only; never in SQLite or `.env`.
- Read-only by default. Write-back is per-goal opt-in surfaced in the UI.
- No webhooks in v1 (would require a public endpoint). Polling only.

## Out of scope for this feature

- GitHub Enterprise Server (cloud-only for v1).
- Code search / file content indexing (lives in unified-search).
- Auto-creating PRs.

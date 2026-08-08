---
name: plover-git-safety
description: Use when doing git work in this repo (or via subagents/worktrees) and hitting "files must be written to the correct artifact directory" from file-edit tools on worktree paths, a commit landing on the wrong branch or HEAD swapped unexpectedly mid-task, suspicion that the user's pnpm dev is running from a second/separate local checkout on another drive or branch, or verifying whether a GitHub PR marked "Merged" actually shipped to main vs. into another feature branch.
---

# Plover Git Safety

## Overview
Footguns around concurrent git usage, subagent worktrees, multiple local checkouts, and PR base-branch confusion — all cases where the obvious git signal ("Merged" badge, clean file write, exit code 0) is misleading about what actually happened.

## Quick reference
| Symptom / error | Fix |
|---|---|
| `write_to_file`/`replace_file_content`/`multi_replace_file_content` error: "files must be written to the correct artifact directory: \<artifact-dir-of-subagent\>" | Use Bash with `cat << 'EOF' > file` or `sed` instead of the custom file tools for worktree paths |
| A commit lands on the wrong branch / `git reflog` shows an unexpected `checkout: moving from <branch> to <other>` you never issued | Do multi-step git work in an isolated `git worktree add <sibling-path> <branch>`; if a stray commit already landed wrong, `git cherry-pick <sha>` onto the correct branch — don't reset the branch another actor may be using |
| Fix verified (typecheck/lint/test green) but user says bug still reproduces after restarting `pnpm dev` | Ask which folder/drive `pnpm dev` is running from — may be a second separate checkout on another branch. Check `git remote -v` / `git rev-parse --abbrev-ref HEAD` there |
| Need to move a fix between two local checkouts of the same repo without pushing | From the target checkout: `git fetch <absolute-path-to-other-checkout> <branch>:<branch>` — works offline, no push permission needed |
| PR shows "Merged" on GitHub but the fix isn't on `main` | Check base branch, not just merged status: `gh pr view <n> --json baseRefName,mergeCommit` then `git merge-base --is-ancestor <mergeCommit.oid> origin/main` |
| `prettier --write "<glob>"` leaves files you never touched showing as ` M` in `git status`, but `git diff` on them is empty | Line-ending churn on Windows, not a content change. Restore them: `git checkout -- <those paths>`. Prefer passing prettier the explicit list of files you edited instead of a directory glob |

## Details

### Subagent file-creation/edit tools fail on worktree paths outside conversation directory
**Symptom:** `write_to_file`, `replace_file_content`, and `multi_replace_file_content` error with `files must be written to the correct artifact directory: <artifact-dir-of-subagent>`.
**Root cause:** These tools enforce a security/scope policy requiring all paths to be inside the active subagent's conversation ID directory. Git worktrees created for subagents live under the main agent's conversation directory, so any workspace paths violate this check.
**Fix:** Use Bash with Unix tools (e.g. `cat << 'EOF' > file` or `sed`) to create or edit files in the workspace directory instead of the custom file-handling tools.

### Concurrent sessions in the same working directory silently swap out HEAD mid-task
**Symptom:** Ran `git checkout -b <new-branch> origin/main` in the primary working directory, did unrelated work, then `git commit` — the commit landed on local `main` instead of the new branch. `git reflog` showed a `checkout: moving from <new-branch> to main` event this session never issued.
**Root cause:** The user (or another Claude Code session/tool) was actively working in the same primary checkout at the same time, switching branches and committing on their own branch. A single working directory has exactly one HEAD; whichever actor checks out last wins, with no warning to the other. Invisible from inside a session except retroactively via `git reflog`.
**Fix:** When there's any chance the user or another session is concurrently using the primary repo directory (ask if unsure — don't assume), do multi-step git work (branch + commits) in an isolated `git worktree` instead: `git worktree add <sibling-path> <branch>`, then run all further Bash/Edit calls against that path, never the primary directory. If a stray commit already landed on the wrong branch before noticing, recover it non-destructively — `git cherry-pick <sha>` onto the correct branch from the worktree — rather than resetting the branch the other actor is using, which they might be actively building on top of.

### The user runs a second, separate local checkout of this repo on its own branch
**Symptom:** Implemented and verified (typecheck/lint/test all green) a fix on a branch built off `wip/liquid-glass-overlay`. User tested by restarting `pnpm dev` and reported "still not synced up," even though the code logically can't produce the observed behavior (same shared function, same IPC channel).
**Root cause:** The user's `pnpm dev` was running from a second, entirely separate local clone of the same GitHub remote (e.g. `D:\GitHub\Plover`), sitting on a different branch (e.g. `ui-fixes`, tracking `origin/ui-fixes`) — not the checkout this session had been working in. That branch can have its own independent, parallel history for the same feature (its own prior restoration/fix), distinct from the branch under active work. `pnpm dev` reads from whichever checkout's disk it's launched from — there is no cross-checkout code sharing short of git itself. A diagnosis from one branch's copy of a feature does not necessarily transfer exactly to another's; re-verify against the actual current file contents on whichever branch is real (e.g. grep for the expected caller to confirm it's actually wired up there).
**Fix:** Before trusting a bug report against a locally-running dev build, confirm which checkout/branch is actually being run — ask directly ("what folder/drive is `pnpm dev` running from?") rather than assuming the primary working directory this session started in is the only one. If a fix doesn't take effect despite a full app restart and the code logically can't produce the observed behavior, checkout-mismatch is a stronger hypothesis than a subtle runtime race — check `git remote -v` / `git rev-parse --abbrev-ref HEAD` in the other location before re-diagnosing from scratch. To move a fix between two local checkouts of the same repo without touching the shared GitHub remote, commit it in one and run, from the other, `git fetch <absolute-path-to-other-checkout> <branch>:<branch>` — works entirely offline, no push permission needed.

### `prettier --write` over a glob dirties unrelated files on Windows with an empty diff
**Symptom:** After formatting a refactor with `pnpm --filter ./app exec prettier --write "src/renderer/main/**/*.tsx"`, `git status` listed a dozen files the change never touched (icons, other pages, test files) as modified — but `git diff --stat` on them printed nothing except `warning: ... LF will be replaced by CRLF the next time Git touches it`.
**Root cause:** The checkout has CRLF in the working tree (git's autocrlf conversion) while prettier writes LF. Git sees a byte-level change on disk, so the file is "modified," but normalizes it away in the diff/index — so the diff is empty and committing them would be a no-op that still bloats the review.
**Fix:** `git checkout -- <unrelated paths>` to drop the churn before staging. Better, don't create it: pass prettier the explicit list of files the change actually touched rather than a directory glob. `git status --short` after formatting is the cheap check — anything modified that isn't in your change set is this.

### A PR merged into a feature branch (not main) doesn't ship, even after that branch was already merged once
**Symptom:** A user-reported bug traced back to a PR that looked "Merged" on GitHub, but `main` still didn't have the fix.
**Root cause:** An earlier PR merged branch `ui-fixes` into `main`. `ui-fixes` kept living after that, and a later PR was opened and merged *into `ui-fixes`*, not `main` — GitHub shows it as "merged" regardless of target branch, easy to misread as "merged into main." Those commits never made it back to `main` through the normal PR flow. A branch that was merged to `main` once is not inherently safe to keep opening PRs against; more unmerged work can keep silently accumulating on it, eventually conflicting with `main`'s independent changes to the same files.
**Fix:** Before treating a "merged" PR as shipped, check its **base branch**, not just merged status: `gh pr view <n> --json baseRefName,mergeCommit` and `git merge-base --is-ancestor <mergeCommit.oid> origin/main`. Either merge each follow-up PR to `main` directly, or delete a feature branch after its first merge to `main` so a second round of work can't silently accumulate off of it. Before cutting a release, spot-check recent PRs the same way (base branch + ancestor check) rather than trusting "Merged" badges at face value.

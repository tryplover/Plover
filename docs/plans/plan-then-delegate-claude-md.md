# Plan: Add a "plan-then-delegate" workflow to CLAUDE.md

## Context

Today CLAUDE.md tells Claude how to work in the repo but doesn't prescribe a
plan-first, subagent-implemented flow. The desired default behavior is:
**don't write code directly — first write a plan to `docs/plans/`, then dispatch
subagents (Haiku by default) to implement that plan.** This keeps the
orchestrating session focused on design/review, makes the work auditable (the
plan is a committed artifact), and uses cheaper models for mechanical
implementation. The repo already has the superpowers skills that encode this
(`writing-plans`, `executing-plans`, `subagent-driven-development`), so CLAUDE.md
just needs to make the flow the standing convention and point at them.

Decisions:
- Plans live in **`docs/plans/`** (new top-level docs dir, distinct from authoritative `docs/superpowers/specs/`).
- Implementation subagents default to **Haiku**, escalating to Sonnet/Opus only for tricky tasks.
- Applies to **non-trivial code changes**; trivial edits (typos, one-liners, doc fixes) may be done directly.

## Changes — all in `CLAUDE.md`

### 1. Add a workflow rule to "How to work in this repo (read this first)"

Insert a new numbered item (becoming item 3, pushing "Verify" and "Use the docs"
down) after the "Lessons-learned is a contract" item (CLAUDE.md:12-17):

> **Plan first, then delegate.** For any non-trivial code change, do not write
> the code yourself in this session. First write an implementation plan to
> `docs/plans/<short-kebab-name>.md` (use the `writing-plans` skill), then
> dispatch subagents to implement it (`subagent-driven-development` /
> `executing-plans`). Default implementation subagents to **Haiku**; escalate
> to Sonnet/Opus only when a task is genuinely tricky. Trivial edits (typos,
> one-line fixes, doc tweaks) may be made directly. The orchestrating session
> stays focused on design, dispatch, and review.

### 2. Add a short "Plan-then-delegate workflow" section

Add a new top-level section (placed after "How to work in this repo", before
"Project") that spells out the loop concisely:

- **Write the plan** → `docs/plans/<name>.md`: context, file-by-file changes,
  reuse of existing utilities, verification steps. Reference the `writing-plans` skill.
- **Delegate implementation** → dispatch Haiku subagent(s) per the plan; one
  agent per independent task. Reference `subagent-driven-development`.
- **Review + verify** → orchestrator reviews diffs and runs
  `pnpm typecheck && pnpm lint && pnpm test` before claiming done (ties into the
  existing "Verify before claiming" rule).
- Note: `docs/plans/` holds *generated implementation plans*; it is distinct from
  `docs/superpowers/specs/`, which remains the authoritative product/phase spec.

### 3. Reflect `docs/plans/` in the "Workspace layout" tree

Add a `docs/plans/` entry to the ASCII tree (CLAUDE.md:38-72) under `docs/` with
a one-line comment like `# generated implementation plans (input to subagents)`.

## Out of scope / notes

- `docs/plans/` now exists (this file). Add a `.gitkeep` only if the dir is ever
  emptied; not needed while plans live here.
- No changes to `.claude/settings.json`, hooks, or skills — this is a convention
  documented in CLAUDE.md, executed by Claude per-session, not harness automation.

## Verification

- Re-read CLAUDE.md top-to-bottom: the new rule and section read consistently
  with existing tone; numbered list renumbered correctly; tree entry present.
- Confirm the referenced skills (`writing-plans`, `subagent-driven-development`,
  `executing-plans`) match names in the available skills list.
- Markdown lint via existing lint-staged/prettier on `*.md` (CLAUDE.md is covered
  by the staged globs); ensure no broken markdown.

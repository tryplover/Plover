# Extract CLAUDE.md Lessons into Reference Skills

> **For agentic workers:** mechanical-ish content-extraction refactor. Follow the assignment table exactly. No new tests.

**Goal:** Move the 33-entry "Lessons learned" section out of `CLAUDE.md` (loaded every session) into ~9 on-demand **reference skills** under `.claude/skills/`, and slim CLAUDE.md to always-relevant rules + a pointer.

**Why:** The lessons section bloats every session's context with situational footguns. As reference skills, they load only when their trigger description matches the problem at hand.

**Skill type:** Reference (not discipline/technique). No pressure-testing; optimize the `description` for discovery instead.

## Skill format (every SKILL.md)

```markdown
---
name: <skill-name>
description: Use when <concrete symptoms/errors/contexts — keyword-rich, third person, NO workflow summary>
---

# <Title>

## Overview
1-2 sentences: what domain of footguns this covers.

## Quick reference
| Symptom / error | Fix |
|---|---|
| <verbatim error or symptom> | <one-line fix + file/command> |

## Details
Per footgun: **Symptom / Root cause / Fix**, condensed from the CLAUDE.md lesson.
KEEP all concrete specifics: exact commands, file paths, version numbers, config snippets.
CUT: narrative ("first instinct was…", session dates unless load-bearing), redundancy.
```

**Description rules (critical for discovery):** start with "Use when…", pack in the actual error strings and symptoms an agent would grep for, third person, do NOT summarize the fix workflow. Keep < 500 chars.

## Assignment (source lines in CLAUDE.md → skill)

| Skill dir `.claude/skills/<name>/SKILL.md` | Absorbs (CLAUDE.md line → heading) |
|---|---|
| `plover-pnpm-workspace` | 215 colon-script `run`; 228 vitest `--coverage` via pnpm `--`; 244 `onlyBuiltDependencies`; 373 corepack vs corporate registry |
| `plover-native-modules` | 316 native ABI Electron 42 / @electron/rebuild; 342 tslib for electron-builder; 450 electron pinned `^42.7.0` not `^33` |
| `plover-electron-vite-build` | 300 externalize deps; 308 duplicate `__dirname`; 326 react/react-dom lockstep crash; 386 preload `.mjs`→cjs; 495 dev `loadURL` vs prod `loadFile` path mismatch |
| `plover-electron-windows-overlay` | 426 setup overlay `variant=window`; 459 transparent BrowserWindow black-box + positioning |
| `plover-env-and-backend` | 292 `load-env` first-import; 394 port 3000/3001; 410 `PLOVER_BACKEND_URL` vite bake |
| `plover-testing` | 276 `vi.mock` hoist / `vi.hoisted`; 284 `removeAllListeners(undefined)`; 350 `noUncheckedIndexedAccess` test pattern; 365 `summaries.task_id` FK fixture seeding; 434 Electron GUI can't launch via Bash (verify differently); 616 rebuild better-sqlite3 for Node ABI before vitest; 637 pre-existing renderer test fails |
| `plover-git-safety` | 268 subagent file-tools fail on worktree paths; 442 concurrent sessions swap HEAD; 522 second checkout on another drive/branch; 592 PR merged to feature branch not `main` |
| `plover-store-schema` | 418 vestigial `calendar_event_id`; 561 `created_at`/`updated_at` not an age signal |
| `plover-gemini` | 260 `functionCalls()` is a method; 334 model fallback on 429 |

## Tasks

### Task A — draft the 9 skills (delegate, parallel; each subagent reads CLAUDE.md for its assigned lines)
For each skill: create `.claude/skills/<name>/SKILL.md` per the format above, absorbing exactly its assigned lessons. Preserve technical specifics; condense narrative. Do not run git/pnpm.

### Task B — rewrite CLAUDE.md (orchestrator)
- Delete the entire `## Lessons learned` section (lines 197–end) INCLUDING the intro paragraph, EXCEPT: verify L203 (pnpm path-based filter) is still reflected as a rule in the Commands section and L402 (Google-API-only-in-Sync) in Architecture rules — they already are; keep them.
- Add a one-line react/react-dom lockstep rule to Code conventions.
- Replace the deleted section with a compact `## Known footguns → skills` pointer: 2-3 sentences saying domain-specific footguns now live as reference skills in `.claude/skills/plover-*`, Claude surfaces them by their trigger descriptions, and — **contract** — when you hit a new footgun, add it to the most relevant existing skill (or create a new `plover-*` skill) instead of growing CLAUDE.md.

### Task C — verify (orchestrator)
- `ls .claude/skills/*/SKILL.md` → 9 files.
- Each has valid frontmatter (`name`, `description` starting "Use when").
- `grep -c "^### 20" CLAUDE.md` → 0 (lessons removed).
- CLAUDE.md still contains the two promoted rules and the new pointer.
- No lesson content lost: every assigned line's core fix appears in its target skill (spot-check).

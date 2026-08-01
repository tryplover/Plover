# Activity Module Folderization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert each module in `app/src/main/activity/` into its own subfolder that separates implementation from its type/constant declarations, establishing a repo-wide pattern (pilot scope: `activity/` only).

**Architecture:** Each flat `activity/<module>.ts` becomes a folder `activity/<module>/` containing: `<module>.ts` (implementation), `types.ts` (interfaces + type-level declarations + module-level data/config constants — only when the module has any), and `index.ts` (a barrel that re-exports the public surface). Consumers import from the folder barrel (`./<module>/index.js`). The `activity/index.ts` orchestrator and the `activity/shared/` helper dir stay where they are.

**Tech Stack:** TypeScript strict, NodeNext ESM (explicit `.js` import extensions), Vitest, electron-vite. Path aliases `@shared/*` → `src/shared/*` and `@main/*` → `src/main/*` (defined in `app/tsconfig.json` + `app/electron.vite.config.ts`).

## Global Constraints

- **No behavior changes.** This is a pure move/reorganize. Do not rename symbols, change logic, or alter runtime behavior.
- **NodeNext import extensions:** every relative import ends in `.js`. Preserve this.
- **Path aliases are move-safe:** imports using `@shared/...` or `@main/...` must NOT be rewritten when a file moves deeper — aliases resolve from the project root, not relatively.
- **Relative imports are depth-sensitive:** a file moving from `activity/` to `activity/<module>/` goes one directory deeper, so every relative import that walks UP (`../...`) gains one more `../`, and `./shared/...` becomes `../shared/...`.
- **Do NOT run `git` commands** during folderization (avoids `.git/index.lock` races between parallel workers). Use plain filesystem moves/writes. Git will detect the renames at commit time.
- **Do NOT run `pnpm`/typecheck inside subagents** (this machine's corepack shim fails behind the corporate registry — see CLAUDE.md lessons). The orchestrator runs verification centrally.
- **types.ts only when there is content.** `folder-watcher`, `gdocs-subscriber`, and `retention` get a folder + `<module>.ts` + `index.ts` barrel but NO `types.ts`.
- **Barrel content:** `index.ts` does `export * from './<module>.js';` and, when a `types.ts` exists, also `export * from './types.js';` — preserving the pre-refactor public export surface.
- **Symbols that move to `types.ts`:** all `interface`, `type`, and `type` re-export declarations, plus module-level *data/config constants* (literals, maps, Sets). Symbols that STAY in the impl file: classes, functions, and derived/behavioral bindings (e.g. `const execFileAsync = promisify(execFile)`).
- **Every declaration moved to `types.ts` must be `export`ed** (the impl file imports them back). Use `export type`/`import type` for type-only symbols to satisfy `verbatimModuleSyntax` if enabled.

---

## Import-rewrite reference (apply to every moved impl file)

When moving `activity/<module>.ts` → `activity/<module>/<module>.ts`, rewrite its relative imports:

| Before (in `activity/`) | After (in `activity/<module>/`) |
|---|---|
| `'../store/...'` | `'../../store/...'` |
| `'../events/...'` | `'../../events/...'` |
| `'../http/...'` | `'../../http/...'` |
| `'../permissions/...'` | `'../../permissions/...'` |
| `'../lifecycle/...'` | `'../../lifecycle/...'` |
| `'../../shared/...'` | `'../../../shared/...'` |
| `'./shared/gate.js'` | `'../shared/gate.js'` |
| `'./shared/serialize-async.js'` | `'../shared/serialize-async.js'` |
| `'@shared/...'` | **unchanged** |
| `'@main/...'` | **unchanged** |
| `'electron'`, `'node:...'`, other bare pkgs | **unchanged** |

`types.ts` lives at the same depth as `<module>.ts`, so any imports IT needs (e.g. `ActivityRepo`, `SettingsRepo`, `NativeImage`, `GitCommitInfo`) use the SAME rewritten depths from the table above.

---

## Task 1: Fold the five modules that HAVE types/constants

Do these five together (they share the identical recipe). Each is independent; they may be done in parallel. For module `M`:

**Files (per module):**
- Create dir: `app/src/main/activity/M/`
- Move: `app/src/main/activity/M.ts` → `app/src/main/activity/M/M.ts`
- Create: `app/src/main/activity/M/types.ts`
- Create: `app/src/main/activity/M/index.ts`

**Recipe (per module):**
- [ ] **Step 1:** Create folder `activity/M/` and move `activity/M.ts` into it as `activity/M/M.ts` (plain `mv`, no git).
- [ ] **Step 2:** In `activity/M/M.ts`, apply the import-rewrite reference table above to every relative import.
- [ ] **Step 3:** Cut the declarations listed below for `M` out of `M.ts` and paste them into a new `activity/M/types.ts`. Add whatever imports `types.ts` needs (rewritten to the same depth). Ensure each declaration is `export`ed.
- [ ] **Step 4:** In `M.ts`, add an import from `'./types.js'` for every symbol it still uses that now lives in `types.ts`.
- [ ] **Step 5:** Create `activity/M/index.ts` with:
  ```ts
  export * from './M.js';
  export * from './types.js';
  ```
- [ ] **Step 6:** Verify by inspection: `M.ts` no longer declares the moved symbols, imports them from `./types.js`, and all `../` depths match the table.

### Per-module specifics

**M = `screen-capturer`** — move to `types.ts`:
- `const VISION_UPLOAD_MAX_WIDTH = 1024;`
- `export interface ScreenCapturerDeps { ... }`
- `interface GrabbedScreen { ... }` → becomes `export interface GrabbedScreen`
- `types.ts` imports needed: `import type { ActivityRepo } from '../../store/repos/activity.js';`, `import type { SettingsRepo } from '../../store/repos/settings.js';`, `import type { NativeImage } from 'electron';`
- `screen-capturer.ts` then imports: `import { VISION_UPLOAD_MAX_WIDTH, type ScreenCapturerDeps, type GrabbedScreen } from './types.js';`

**M = `inference`** — move to `types.ts`:
- `const BASELINE_INFERENCE_INTERVAL_MS = 30 * 60_000;`
- `const FAST_INFERENCE_INTERVAL_MS = 10 * 60_000;`
- `const TASK_YOUNG_WINDOW_MS = 2 * 60 * 60_000;`
- `const EPOCH_TS = '1970-01-01T00:00:00.000Z';`
- `const SCREENSHOT_ACTIVITY_KINDS = new Set([...]);`
- `export interface TaskProgressEntry { ... }`
- `interface InferProgressResponse { ... }` → becomes `export interface InferProgressResponse`
- Also move any OTHER top-level `const`/`interface`/`type` on lines 10–37 of the original file that fit the "data/config constant or type" rule (inspect lines 14–21 for any spanning declarations). Do NOT move the `InferenceEngine` class.
- `types.ts` imports needed: `import type { ActivityRow } from '../../store/repos/activity.js';` only if a moved type references it (check `InferProgressResponse`/`TaskProgressEntry`); otherwise none.
- Export each; `inference.ts` imports them all back from `./types.js`.

**M = `commit-task-matcher`** — move to `types.ts`:
- `export interface MatchCommitResponse { ... }`
- `export type CommitMatcher = (commit: GitCommitInfo, ...) => Promise<MatchCommitResponse>;`
- `types.ts` imports needed: `import type { GitCommitInfo } from '@shared/events.js';` (alias — unchanged)
- Keep in impl: `class CommitTaskMatcher`, `function defaultNotify`.
- `commit-task-matcher.ts` imports: `import type { MatchCommitResponse, CommitMatcher } from './types.js';`

**M = `window-tracker`** — move to `types.ts`:
- `const BROWSER_BUNDLES: Record<string, string> = { ... };`
- `interface WindowMeta { ... }` → becomes `export interface WindowMeta`
- `types.ts` imports needed: none.
- `window-tracker.ts` imports: `import { BROWSER_BUNDLES, type WindowMeta } from './types.js';`

**M = `git-commit-tracker`** — move to `types.ts`:
- The re-export `export type { GitCommitInfo };` → in `types.ts` write `export type { GitCommitInfo } from '@shared/events.js';`
- Keep in impl: `const execFileAsync = promisify(execFile);` (behavioral binding — STAYS), `class GitCommitTracker`, `function extractRepoPath`.
- `git-commit-tracker.ts` keeps its own `import { FolderEventPayload, GitCommitInfo } from '@shared/events.js';` for internal use (unchanged, alias). Remove only the standalone `export type { GitCommitInfo };` line (now in types.ts).
- `index.ts` barrel `export * from './types.js'` restores the public `GitCommitInfo` re-export.

---

## Task 2: Fold the three modules with NO types/constants

For each M in {`folder-watcher`, `gdocs-subscriber`, `retention`}:

**Files (per module):**
- Create dir: `app/src/main/activity/M/`
- Move: `app/src/main/activity/M.ts` → `app/src/main/activity/M/M.ts`
- Create: `app/src/main/activity/M/index.ts`

**Recipe:**
- [ ] **Step 1:** Create folder `activity/M/`, move `activity/M.ts` → `activity/M/M.ts` (plain `mv`).
- [ ] **Step 2:** Apply the import-rewrite reference table to `M.ts`.
- [ ] **Step 3:** Create `activity/M/index.ts` with a single line: `export * from './M.js';`
- [ ] **Step 4:** Do NOT create a `types.ts`.

Note `folder-watcher.ts` and `gdocs-subscriber.ts` use `./shared/...` (→ `../shared/...`); `gdocs-subscriber.ts` and `inference` peers use `../../shared/...` (→ `../../../shared/...`); `retention.ts` only imports `../store/...` (→ `../../store/...`).

---

## Task 3: Update the barrel and the tests (orchestrator-owned, after Tasks 1–2)

**Files:**
- Modify: `app/src/main/activity/index.ts` (8 import lines)
- Modify: all import lines in `app/tests/activity/*.test.ts` that reference an activity module

- [ ] **Step 1:** In `activity/index.ts`, change each module import from `'./<module>.js'` to `'./<module>/index.js'` for all 8 modules (window-tracker, gdocs-subscriber, screen-capturer, folder-watcher, inference, git-commit-tracker, commit-task-matcher, retention). Leave `'../store/index.js'` and `'../events/bus.js'` unchanged.
- [ ] **Step 2:** In `tests/activity/`, rewrite every import of an activity module to point at the folder barrel:
  - `'@main/activity/<module>.js'` → `'@main/activity/<module>/index.js'`
  - `'../../src/main/activity/<module>.js'` → `'../../src/main/activity/<module>/index.js'`
  Known occurrences: commit-task-matcher (2 files, incl. `defaultNotify`), git-commit-tracker (2 files, incl. `extractRepoPath`), inference, folder-watcher, retention, window-tracker, screen-capturer, gdocs-subscriber.
- [ ] **Step 3:** Verify no stale flat references remain:
  ```bash
  grep -rn "activity/\(screen-capturer\|inference\|commit-task-matcher\|window-tracker\|git-commit-tracker\|folder-watcher\|gdocs-subscriber\|retention\)\.js" app/src app/tests | grep -v "/index.js"
  ```
  Expected: no output.

---

## Task 4: Central verification (orchestrator)

- [ ] **Step 1:** `export PATH="$HOME/Library/pnpm:$PATH"` then `pnpm --filter ./app typecheck` → expect clean.
- [ ] **Step 2:** `pnpm --filter ./app lint` → expect clean (watch for unused-import or import-order errors introduced by the move).
- [ ] **Step 3:** `pnpm --filter ./app run test` → expect all activity tests green.
- [ ] **Step 4:** Add a dated "Lessons learned" entry to CLAUDE.md if anything behaved unexpectedly (per repo contract).

---

## Self-Review notes

- **Coverage:** all 8 modules (5 with types, 3 without) + barrel + tests + verification are covered by Tasks 1–4.
- **Type consistency:** barrel re-exports `export * from './types.js'` preserve every formerly-public type (`ScreenCapturerDeps`, `TaskProgressEntry`, `MatchCommitResponse`, `CommitMatcher`, `GitCommitInfo`). Formerly-private symbols (`GrabbedScreen`, `InferProgressResponse`, `WindowMeta`, `BROWSER_BUNDLES`, interval consts) become folder-exported; this is an accepted, contained surface widening (nothing outside `activity/` imports them — verified).
- **Alias safety:** `@shared`/`@main` imports intentionally left unchanged; only relative depths bumped.

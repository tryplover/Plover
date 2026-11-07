# Plan: Consolidate `activity/` subfolders by domain

## Context

`app/src/main/activity/` currently holds 14 flat feature subfolders plus
`shared/` and `index.ts`. Group the feature subfolders by domain so the folder
tree communicates provenance. **Move-only refactor** — no behavior, no class
names, no file basenames change. Single atomic PR (splitting would only create
`index.ts`/test merge churn with no independent review value).

## Target tree

```
activity/
  sources/
    google/   gmail-subscriber/ calendar-subscriber/ classroom-subscriber/ gdocs-subscriber/
    github/   github-commit-subscriber/ github-pr-subscriber/ github-review-subscriber/
    git/      git-commit-tracker/
    system/   folder-watcher/ window-tracker/ screen-capturer/
  processing/ inference/ retention/ commit-task-matcher/
  shared/                          # UNCHANGED location (activity/shared/)
  index.ts                         # UNCHANGED location (activity/index.ts)
```

### Folder → new path map

| current (`activity/…`) | new (`activity/…`) |
|---|---|
| `gmail-subscriber` | `sources/google/gmail-subscriber` |
| `calendar-subscriber` | `sources/google/calendar-subscriber` |
| `classroom-subscriber` | `sources/google/classroom-subscriber` |
| `gdocs-subscriber` | `sources/google/gdocs-subscriber` |
| `github-commit-subscriber` | `sources/github/github-commit-subscriber` |
| `github-pr-subscriber` | `sources/github/github-pr-subscriber` |
| `github-review-subscriber` | `sources/github/github-review-subscriber` |
| `git-commit-tracker` | `sources/git/git-commit-tracker` |
| `folder-watcher` | `sources/system/folder-watcher` |
| `window-tracker` | `sources/system/window-tracker` |
| `screen-capturer` | `sources/system/screen-capturer` |
| `inference` | `processing/inference` |
| `retention` | `processing/retention` |
| `commit-task-matcher` | `processing/commit-task-matcher` |

## Depth shift (the load-bearing detail)

Relative imports inside moved files must gain `../` equal to the extra nesting:

- **Everything under `sources/…`** moves depth-1 → depth-3 → **prepend 2 `../`**
  to every specifier that starts with `../`.
- **Everything under `processing/…`** moves depth-1 → depth-2 → **prepend 1 `../`**.

Worked examples (a `sources/` file, +2):
- `'../../store/repos/activity.js'` → `'../../../../store/repos/activity.js'`
- `'../../../shared/events.js'` → `'../../../../../shared/events.js'`
- `'../shared/gate.js'` (activity-local shared) → `'../../../shared/gate.js'`

Worked examples (a `processing/` file, +1):
- `'../../store/repos/tasks.js'` → `'../../../store/repos/tasks.js'`
- `'../../../shared/types.js'` → `'../../../../shared/types.js'`
- `'../../http/authed-fetch.js'` → `'../../../http/authed-fetch.js'`
- `'../../lifecycle/periodic.js'` → `'../../../lifecycle/periodic.js'`

Rule: for each moved file, prepend N copies of `../` to **every** import
specifier beginning with `../` (N = 2 for `sources/*`, N = 1 for `processing/*`).
Do NOT touch specifiers that don't start with `../`.

## File-by-file changes

### 1. Move folders (use `git mv` so rename detection stays clean)
Create the group dirs and `git mv` each folder per the map above. `shared/` and
`index.ts` do not move.

### 2. Rewrite relative imports inside every moved `.ts` file
Apply the depth-shift rule above. Affected files are every `.ts` inside the
moved folders (`*.ts`, `index.ts`, `types.ts`). `shared/gate.ts` does NOT move,
so its own imports are unchanged.

### 3. `activity/index.ts` (does not move — update subfolder specifiers only)
Rewrite each `./<folder>/…` to its new grouped path, e.g.:
- `'./window-tracker/index.js'` → `'./sources/system/window-tracker/index.js'`
- `'./gdocs-subscriber/index.js'` → `'./sources/google/gdocs-subscriber/index.js'`
- `'./gmail-subscriber/gmail-subscriber.js'` → `'./sources/google/gmail-subscriber/gmail-subscriber.js'`
- `'./calendar-subscriber/calendar-subscriber.js'` → `'./sources/google/calendar-subscriber/calendar-subscriber.js'`
- `'./classroom-subscriber/classroom-subscriber.js'` → `'./sources/google/classroom-subscriber/classroom-subscriber.js'`
- `'./github-commit-subscriber/github-commit-subscriber.js'` → `'./sources/github/github-commit-subscriber/github-commit-subscriber.js'`
- `'./github-pr-subscriber/github-pr-subscriber.js'` → `'./sources/github/github-pr-subscriber/github-pr-subscriber.js'`
- `'./github-review-subscriber/github-review-subscriber.js'` → `'./sources/github/github-review-subscriber/github-review-subscriber.js'`
- `'./screen-capturer/index.js'` → `'./sources/system/screen-capturer/index.js'`
- `'./folder-watcher/index.js'` → `'./sources/system/folder-watcher/index.js'`
- `'./git-commit-tracker/index.js'` → `'./sources/git/git-commit-tracker/index.js'`
- `'./inference/index.js'` → `'./processing/inference/index.js'`
- `'./commit-task-matcher/index.js'` → `'./processing/commit-task-matcher/index.js'`
- `'./retention/index.js'` → `'./processing/retention/index.js'`
Leave `'../store/index.js'` and `'../events/bus.js'` untouched.

### 4. Test imports (`app/tests/activity/*.test.ts`)
Insert the group segment into both alias and relative forms. Both are just the
path map applied — depth of the specifier itself does not otherwise change:
- `@main/activity/<folder>/…` → `@main/activity/<group>/<folder>/…`
- `../../src/main/activity/<folder>/…` → `../../src/main/activity/<group>/<folder>/…`

(No `git mv` for tests — test files stay in `tests/activity/`; only the import
strings change.)

## Verification (must be green before done)

Run from repo root:
```
pnpm typecheck && pnpm lint && pnpm --filter ./app run test
```
Also `grep -rn "activity/" app/src app/tests --include='*.ts'` and confirm no
specifier still points at an old flat path (e.g. `activity/gmail-subscriber`
without a group segment). `tsc` with NodeNext will catch a wrong `../` count as
a module-not-found error, so a green typecheck is the primary signal the
depth-shift math is right.

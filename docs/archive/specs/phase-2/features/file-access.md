# Feature: Full-disk file access (stub)

> Read [../overview.md](../overview.md) first.
>
> **Status:** stub. Expand to a detailed spec before writing its plan.

Give Plover broad read access to the user's local filesystem so the agent can:

- index file metadata + selected content into the unified search index,
- detect when relevant files are modified (beyond the currently user-selected `FolderWatcher` set),
- pull file context into decomposition (e.g. "the user just edited `meeting-notes.md` — surface it when they type a related goal").

## Open questions (resolve before plan)

1. **Permission ask.** macOS Full Disk Access cannot be requested via API — the user must add the app in **System Settings → Privacy & Security → Full Disk Access**. The Settings UI must walk them through this with screenshots.
2. **What to index.** Heuristic v1: skip `node_modules`, `.git`, `Library`, `.cache`, binaries, files > 5 MB. Index file metadata always; index content only for: `.md`, `.txt`, `.pdf` (extracted), `.docx` (extracted), source files in user-allowlisted dirs.
3. **Indexer cadence.** Initial scan on permission grant (could take minutes); incremental updates via `fs.watch` / `chokidar` for subdirs of `~/`.
4. **Content extraction.** `pdf-parse` for PDFs, `mammoth` for `.docx`, raw read for text. No OCR in v1.
5. **Privacy ceiling.** Even with Full Disk Access granted, never index `~/Library/Mail`, `~/Library/Messages`, `~/Library/Application Support/*` by default. Explicit allowlist of indexable top-level dirs.

## Sketch of module additions

- `app/src/main/activity/file-indexer.ts` — initial scan + incremental updates.
- `app/src/main/store/repos/search-index.ts` — FTS5 virtual table (shared with unified-search).
- Settings UI: permission walkthrough, allowed-directory list, exclusion patterns, "Re-index now" button.

## Hard constraints

- No outbound HTTP for file content. Full Disk Access stays local.
- Settings has a master "Pause file indexing" switch.
- The user-selected exclusion list overrides defaults (additive only — cannot include excluded dirs).
- File contents never go to Gemini unless screen-tracking-style explicit opt-in is added.

## Out of scope for this feature

- Cloud storage (already covered by Drive integration).
- OCR for image files.
- File write-back (Plover never writes to user files outside its `userData` dir).

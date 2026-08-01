---
name: plover-store-schema
description: Use when touching the tasks table schema in app/src/main/store/db.ts and encountering the vestigial calendar_event_id column, when deciding whether to reference calendar_event_id, or when building any "task age" / "how long has this task been in progress" / adaptive polling cadence signal off tasks.created_at or tasks.updated_at — both are unreliable since Planner bulk-creates subtasks with shared created_at and TasksRepo.incrementProgress() bumps updated_at on every call.
---

# Plover store schema gotchas

## Overview
Covers two `Store` (`app/src/main/store/`) schema footguns: a vestigial column left over from a removed feature, and why `tasks` timestamp columns can't be used as an "age since work began" signal.

## Quick reference
| Symptom / error | Fix |
|---|---|
| Tempted to read/write `tasks.calendar_event_id` after calendar sync removal | Column is vestigial — do not reference it; only touch via a proper `ALTER TABLE tasks DROP COLUMN calendar_event_id` migration if already modifying the tasks schema |
| Need a "task started recently" / "task age" signal for polling cadence, and `created_at`/`updated_at` look self-consistent but the cadence never backs off or timestamps don't reflect actual start time | Track first-seen-in-progress timestamps in memory (`Map<taskId, timestampMs>`), not in a persisted `tasks.*_at` column |

## Details

### `tasks.calendar_event_id` is vestigial
**Symptom:** `store/db.ts` still defines `calendar_event_id TEXT` on the `tasks` table even though no application code reads or writes it after the Calendar-sync removal.

**Root cause:** Dropping a column requires a new migration, and existing installs would fail if v1 were altered in place. The column was deliberately left so existing DBs stay usable.

**Fix:** Do NOT re-add references to `calendar_event_id`. If touching the tasks schema for another reason, bundle a proper `ALTER TABLE tasks DROP COLUMN calendar_event_id` migration then (SQLite ≥3.35 supports it). Until then, treat the column as vestigial.

### `created_at`/`updated_at` are not a "when did work begin" signal
**Symptom:** While building an adaptive polling cadence for `InferenceEngine` (poll faster while a task is newly started), the first instinct was to key "newly started" off `tasks.created_at` or `tasks.updated_at`. Both are wrong, for different reasons, and the bug doesn't show up in a quick manual test — only over time or across multiple tasks in the same goal.

**Root cause:**
1. `created_at` reflects when the **goal** was decomposed, not when this specific subtask's work began. Planner bulk-creates all of a goal's subtasks in one pass (`TasksRepo.create()` in `app/src/main/store/repos/tasks.ts`), so every subtask in a goal shares essentially the same `created_at` regardless of when the user actually starts each one.
2. `updated_at` looks like a better fit (it changes when a task moves to `in_progress` via `.update()`), but `TasksRepo.incrementProgress()` **also** bumps `updated_at` on every call — including calls made by the very inference pass reading it. Using `updated_at` as the age signal creates a self-refreshing loop: every fast-cadence pass that increments progress resets the timestamp, so the task looks "freshly started" forever and the cadence never backs off to baseline.

**Fix:** Don't derive "task age" from any persisted task-table timestamp. Track it in memory instead: `InferenceEngine.firstSeenInProgressAt` (a `Map<taskId, timestampMs>`) records the moment each task is first observed with `status === 'in_progress'`, dropping entries once a task leaves that status. Accepts resetting on app restart as a simple tradeoff. General rule: before using any `*_at` column as an "age since X happened" signal, check what else writes to that column and whether rows for the same "unit of work" get bulk-created together — either can silently invalidate the assumption.

# Implementation Plan: Markdown TODO Harvester (Obsidian Sync)

Many users track their subtasks inside their own notes (like an Obsidian notebook) or as `TODO` code comments rather than inside a task manager app. This feature parses watched files for markdown checklist items (`- [ ]` and `- [x]`) and TODO comments, automatically syncing them into Plover.

## Technical Design

```
+-------------------------------------------------------------------------------+
|                             Electron Client App                               |
|                                                                               |
|  1. Watch Markdown Changes  --> 2. Parse Checkboxes   --> 3. Sync to SQLite   |
|     (Obsidian vault file)         (- [ ] or - [x])         (goals/tasks tables)|
|                                                                     |         |
|  5. Update Google Calendar  <-- 4. Automatically Mark Done <--------+         |
|     (slot allocation sync)        (if checked off in file)                    |
+-------------------------------------------------------------------------------+
```

### 1. Markdown Parsing Loop
* When `FolderWatcher` fires a `'change'` or `'add'` event on a `.md` (Markdown) file:
  * Read the file line-by-line using Node's `fs.promises.readFile`.
  * Regular expressions to match tasks:
    * Uncompleted: `/^\s*-\s*\[\s*\]\s+(.+)$/i` (matches `- [ ] Task Name`)
    * Completed: `/^\s*-\s*\[x\]\s+(.+)$/i` (matches `- [x] Task Name`)
  * Extract all checkboxes.

### 2. Task Synchronization in SQLite
* For each extracted checkbox name:
  1. Check if a task with the same title already exists under the corresponding active goal in SQLite.
  2. If it **doesn't exist** and is uncompleted:
     - Automatically create a new task in SQLite and schedule it into an open calendar slot.
  3. If it **exists** and is marked `[x]` in the file, but is still `todo` or `scheduled` in SQLite:
     - Automatically mark it as `done` in SQLite and trigger GCal synchronization.
  4. If it **exists** and is marked `[ ]` in the file, but is `done` in SQLite:
     - Revert it back to `todo` (supporting toggle states).

---

## Step-by-Step Subtasks for Subagent

- [ ] **Subtask 1: Markdown Checklist Parser**
  - Create `app/src/main/activity/markdown-parser.ts` implementing a parsing class.
  - Write testable parser functions that take a markdown string and return `{ title: string, completed: boolean }[]`.
- [ ] **Subtask 2: Watcher Synchronization Hook**
  - Hook the markdown parser into the `FolderWatcher` change event listener in [folder-watcher.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/app/src/main/activity/folder-watcher.ts).
  - Implement the SQLite lookup, insertion, and update logic in the sync hook.
- [ ] **Subtask 3: Unit Testing**
  - Create `app/tests/activity/markdown-parser.test.ts`. Use a temporary markdown file to verify that modifying, adding, and checking boxes inside the file automatically triggers database sync.

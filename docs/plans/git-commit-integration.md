# Implementation Plan: Git Commit Integration (Auto-Completion)

For developers and students writing code, git commits are the absolute highest-signal progress events. This feature watches local Git repositories in watched folders for commits and uses their commit messages to automatically resolve and complete tasks.

## Technical Design

```
+-------------------------------------------------------------------------------+
|                             Electron Client App                               |
|                                                                               |
|  1. Watch .git/COMMIT_EDITMSG  --> 2. Read Commit Msg  --> 3. Send to Server  |
|     (via FolderWatcher)            ("feat: add parser")        (commit + tasks) |
|                                                                     |         |
|  5. Complete Task & Notify  <--  4. Parse Match   <--  [API Response]         |
|     (set status to done)             ({ taskId: "t1" })                       |
+-------------------------------------------------------------------------------+
```

### 1. Git Commit Monitoring
* Extend the `FolderWatcher` in `app/src/main/activity/folder-watcher.ts` to inspect if a newly added folder contains a `.git/` directory.
* If so, register a chokidar watcher specifically on `.git/COMMIT_EDITMSG` or `.git/index`.
* When a commit occurs, extract the latest commit message:
  * Run a shell command in the repository folder: `git log -1 --pretty=format:"%B"`.
  * Log the commit message to SQLite under `kind: 'git_commit'` with payload `{ repoPath, message, hash }`.

### 2. Commit-to-Task Mapping (Backend / Client-side reasoning)
* Call the backend API proxy `/api/infer-progress` (or a dedicated endpoint `/api/match-commit`) with:
  * The commit message (e.g., `"refactor AST generator to support binaries"`).
  * The list of active tasks for the goal.
* Gemini maps the commit message to the closest matching subtask:
  * *Prompt:* *"Which of these tasks is completed by this git commit message: '[message]'? If any, return its ID."*
  * *Response JSON:* `{ matchedTaskId: "t1" | null, reasoning: "User implemented AST features" }`
* If a match is found, mark the task as `done` and notify the user via a native banner: *"Marked 'Generate AST' as done based on your git commit!"*

---

## Step-by-Step Subtasks for Subagent

- [ ] **Subtask 1: Git Repository Watcher**
  - Modify `app/src/main/activity/folder-watcher.ts` to scan folders for `.git` presence.
  - Implement Git log capture using `child_process.exec` running `git log -1` on commit edits.
- [ ] **Subtask 2: Commit Matching API**
  - Add commit matching support to the backend proxy in [server/src/index.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/server/src/index.ts).
  - Write a prompt template that takes a git commit string and returns a matching task ID.
- [ ] **Subtask 3: Unit Testing**
  - Create `app/tests/activity/git-commit.test.ts`. Mock `exec` to return git commit headers and verify it automatically triggers database status updates.

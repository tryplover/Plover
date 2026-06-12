# Implementation Plan: Auto-Completion Inference Pass (Done Detection Engine)

This feature enables Plover to automatically infer when subtasks have been worked on or completed, marking them as `done` in the database without any manual clicks from the user.

## Technical Design

```
+-------------------------------------------------------------------------------+
|                             Electron Client App                               |
|                                                                               |
|  1. Periodic Cron   -->   2. Read Recent logs   -->  3. Send to Server        |
|     (every 30 mins)          (activity table)           (fetch /infer-progress) |
|                                                                 |             |
|  5. Apply DB Updates  <--  4. Parse Response  <--  [API Response]             |
|     (tasks table status)      ({ completed: [] })                             |
+-------------------------------------------------------------------------------+
                                                              |
                                                              v
+-------------------------------------------------------------------------------+
|                             Backend Proxy Server                              |
|                                                                               |
|  - Receives active tasks and recent activity logs                            |
|  - Calls Gemini (structured schema) to map activity to task completions        |
|  - Returns array of completed Task IDs and progress percentages               |
+-------------------------------------------------------------------------------+
```

### 1. Database Schema
We will write progress summaries and signal scores to the existing `summaries` table:
```sql
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  ts TEXT,
  summary TEXT,
  signal REAL
);
```

### 2. Backend API Endpoint (`server/src/index.ts`)
* **Endpoint:** `POST /api/infer-progress`
* **Request Payload:**
  ```json
  {
    "tasks": [{ "id": "t1", "title": "Implement parser" }],
    "activity": [
      { "kind": "file_modified", "payload": { "path": "/src/parser.ts" } },
      { "kind": "window_focus", "payload": { "app": "VS Code", "title": "parser.ts" } }
    ]
  }
  ```
* **Gemini Prompt:** Analyze the recent computer activities to see if any of the active tasks have been worked on (percentage progress) or completed.
* **Response Schema (Structured JSON):**
  ```json
  {
    "task_progress": [
      {
        "taskId": "t1",
        "progress_increment": 50,
        "completed": true,
        "reasoning": "User edited parser.ts and wrote parser tests for 40 minutes."
      }
    ]
  }
  ```

### 3. Electron Client Inference Loop (`app/src/main/activity/inference.ts`)
* Initialize a loop running every 30 minutes in the main process.
* Fetch active goals and tasks (`status = 'todo' | 'scheduled'`).
* Fetch activity logs where `ts > LAST_INFERENCE_TIME`.
* Call the backend `/api/infer-progress` endpoint.
* If a task is marked as `completed: true`, execute `tasksRepo.update(taskId, { status: 'done' })` and emit `task.completed`.
* Save the reasoning summary and signal score to the `summaries` table.

---

## Step-by-Step Subtasks for Subagent

- [ ] **Subtask 1: Backend Endpoint Implementation**
  - Add `POST /api/infer-progress` to [server/src/index.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/server/src/index.ts).
  - Configure the Gemini model call using `FunctionCallingMode` or Structured Outputs to enforce the JSON schema.
- [ ] **Subtask 2: Inference Client Logic**
  - Create `app/src/main/activity/inference.ts` with `InferenceEngine` class.
  - Implement a `runInferencePass()` method that queries the SQLite database, bundles the payload, makes the fetch call, and applies the DB updates.
- [ ] **Subtask 3: Test Suite Integration**
  - Create `app/tests/activity/inference.test.ts` mocking the server response and verifying tasks are automatically marked as `done` in the SQLite instance.
- [ ] **Subtask 4: Main Initialization**
  - Hook the `InferenceEngine` to the app ready/quit handlers in [app/src/main/activity/index.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/app/src/main/activity/index.ts).

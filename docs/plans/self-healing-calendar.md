# Implementation Plan: Self-Healing Calendar (Auto-Rescheduling)

This feature automatically detects when a user slips or misses their scheduled task time blocks, automatically moving the task blocks forward in the calendar to prevent scheduling collisions and gaps.

## Technical Design

```
+-------------------------------------------------------------------------------+
|                             Electron Client App                               |
|                                                                               |
|  1. Check Ended Blocks  -->   2. Analyze Active Logs  -->  3. If Off-Track?   |
|     (runs every 15 min)         (check window focus)          (AFK or distraction)|
|                                                                     |         |
|  5. Send Notification   <--   4. Re-run Schedule & GCal Update <----+         |
|     ("Moved X to tomorrow")     (call scheduleTasks helper)                   |
+-------------------------------------------------------------------------------+
```

### 1. Detection Logic
* Periodically (every 15 minutes), scan the `tasks` table for tasks whose `scheduled_end` is in the past, but whose `status` is still `'scheduled'` or `'todo'` (not `'done'`).
* For each found task:
  1. Inspect the `activity` logs between the task's `scheduled_start` and `scheduled_end`.
  2. If the user was AFK (no keypress logs, no window change logs) or active mostly on non-productive apps (e.g. YouTube, Twitter, gaming apps, defined via settings blacklist), flag the block as **missed**.

### 2. Auto-Rescheduling Logic
* For any flagged **missed** task:
  1. Release its old slot on Google Calendar (delete the calendar event or update it).
  2. Call the scheduling algorithm (`scheduleTasks` in `app/src/main/planner/schedule.ts`) to find the next available slot within the user's `workingHours` settings, taking into account other existing events.
  3. Update SQLite: set `scheduled_start`, `scheduled_end`, and `calendar_event_id` to the new values.
  4. Write the update to Google Calendar.
  5. Push a native macOS notification: *"Slid 'Review Code' to tomorrow at 10 AM since you were away."*

---

## Step-by-Step Subtasks for Subagent

- [ ] **Subtask 1: Deviation Detector Service**
  - Create `app/src/main/planner/deviation-detector.ts` implementing a `DeviationDetector` class.
  - Implement a method `checkCompletedBlocks()` that queries SQLite for past-scheduled tasks that are not done, analyzes the active window focus and keypress activity logs, and returns a list of missed tasks.
- [ ] **Subtask 2: Rescheduler Integration**
  - Implement a method `rescheduleTask(task: Task)` that calls the existing client-side `scheduleTasks()` scheduler, writes back the new slot to SQLite, and updates the event on Google Calendar via the `calendarSync` service.
- [ ] **Subtask 3: Unit Testing**
  - Create `app/tests/planner/deviation-detector.test.ts` mocking the activity logs (e.g. showing AFK status during the 2-hour task block) and asserting that the task's schedule slides forward in the database.
- [ ] **Subtask 4: Cron/Interval Setup**
  - Hook the deviation detector loop to run every 15 minutes inside the main Electron process lifecycle.

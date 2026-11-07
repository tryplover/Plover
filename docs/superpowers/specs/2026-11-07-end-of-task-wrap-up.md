# End-of-task wrap-up: stop and ask how it went

**Status:** Design, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4.2 (task breakdown) and §4.3 (check-in).
**Related:** [saved tasks](2026-11-07-saved-tasks-design.md), which owns task state, park/resume and "done".

## 1. Problem

When the user ticks the last step of a task, today:
- a short celebration animation plays;
- the timer **keeps running** on a task with nothing left to do;
- the popup keeps showing the finished task;
- nothing asks how it went.

The user wants finishing a task to **end the session** and ask **how the work session went**.

## 2. Goals and non-goals

**Goals**
1. Completing a task (all steps ticked, or **Mark done**) stops the timer, turns off focus mode and blocking, and shows a short wrap-up.
2. The wrap-up asks one light question about the session and takes one tap to answer, or can be skipped.
3. The answer is stored locally with the task, so it can be shown later (for example in the saved-tasks Done section).
4. The tone stays encouraging and non-judgmental (spec §2).

**Non-goals**
- Stats, streaks, charts or any gamification (spec: planned after launch).
- Sending reflections anywhere. They stay in `chrome.storage.local`.
- Changing the per-block check-in ("Which step did you finish?"), which stays as is.

## 3. User experience

### 3.1 Trigger

- Ticking the **last open step**, from the popup, the in-page panel or the block check-in, or choosing **Mark done** (saved-tasks design).
- Not triggered for tasks with zero steps; for those, **Mark done** is the trigger.
- If the last step is ticked during a **break**, the break ends too.

### 3.2 The wrap-up screen

Shown in the popup and the in-page panel (it replaces the running view):

```
TASK DONE · 2 BLOCKS · 47 MIN
        (bird, celebrating)
Nice work on "History essay: the intro".
How did that session go?

  [ 😌 Smooth ]  [ 🙂 Okay ]  [ 😮‍💨 Tough ]

  Add a note (optional)
  [                                        ]

[Done]   Skip
```

- The eyebrow shows focus blocks completed and total focused time for this task, from `sessions` (sum of work sessions with this `taskId`).
- Three choices plus an optional one-line note. Tapping a choice selects it; **Done** saves; **Skip** saves nothing.
- After **Done** or **Skip**, the popup returns to the idle screen.
- If no page with the buddy is visible, a system notification ("Task done. How did it go?") opens the popup on click, as the per-block check-in does today.
- Styling: Figma tokens. The choices are Chip-style toggles (pill radius, quiet bg when selected); **Done** is a Compact button.

### 3.3 Undo

Unticking a step within 10 seconds of the wrap-up appearing reopens the task and resumes the timer from where it stopped (`parked` time from the saved-tasks design). After that, the task stays done; **Reopen** lives in the Done section.

## 4. Data model

```ts
export interface Task {
  // existing fields …
  doneAt: number | null;
  reflection?: {
    mood: "smooth" | "okay" | "tough";
    note: string | null; // trimmed, max 280 chars
    at: number;
  } | null;
}

export interface Transient {
  // existing fields …
  wrapUpTaskId: string | null; // set when a task completes, cleared by answer/skip
}
```

## 5. Behaviour (worker, single command queue)

| Command / event | Effect |
|---|---|
| `step/toggle` making the last open step done, or `checkin/answer` doing so | Set `doneAt`, stop the timer (focus and blocking off via the existing `stopped` listener), set `transient.wrapUpTaskId`, keep `celebrateUntil`. |
| `task/markDone` (saved-tasks design) | Same as above. |
| `wrapup/answer { taskId, mood, note }` | Write `reflection`, clear `wrapUpTaskId`. |
| `wrapup/skip { taskId }` | Clear `wrapUpTaskId`. |

- Pure helper `completionOf(task)` and `sessionSummary(sessions, taskId)` in `features/tasks/`, unit-tested.
- The work session in progress is logged by `bookkeep()` as `completed: false` when the timer stops early. That's accurate: the block was cut short because the task finished.

## 6. Interaction with the per-block check-in

If a block ends with `checkInPending` and the user answers with the last open step, they see the wrap-up instead of returning to a running timer, so the two questions never stack.

## 7. Testing

- Unit: `completionOf`, `sessionSummary`.
- Worker: last-step tick stops the timer and sets `wrapUpTaskId`; answer and skip clear it; reflection is persisted; undo within 10 s reopens and resumes.
- Playwright: tick the last step, then the wrap-up shows, focus is off and blocking rules are removed; answer, then the idle screen shows.

## 8. Delivery

Lands after the saved-tasks stack (it uses `doneAt` handling, `task/markDone` and `parked` for undo). Two PRs: worker and data, then UI.

## 9. Open questions

1. Three moods, or a 1–5 scale? This design uses three words, lighter and less "grading".
2. Show past reflections anywhere in v1? This design stores them, and the Done section can show the mood icon.
3. Should finishing a task during focus mode start the next saved task automatically? This design says no.

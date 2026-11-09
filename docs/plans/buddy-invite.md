# Buddy invite: "Want to start a focus block?"

## Goal

When no timer is running, the buddy sometimes asks **"Want to start a focus block?"** with **Start / Later / Not today**. It is a new buddy state, `inviting` (the existing "check-in" is the end-of-block step question; keep the two apart). Plover still reads nothing from the page: every trigger uses only Plover's own state and clock.

Decisions (2026-11-09, product owner):

- Triggers (all on by default, one switch to turn them off):
  1. **First browse of the day:** the first time a buddy appears on a page (state port connects) on a new local day.
  2. **After Stop:** 10 minutes after the timer is stopped, if no phase has started since.
  3. **Long idle:** no timer activity for 45 minutes, and no invite in the last 45 minutes.
- Breaks keep rolling into the next work block automatically (no change to the timer machine).
- Answers: **Start** opens the panel at the task box (the normal idle panel); **Later** stops invites for 30 minutes; **Not today** stops them until the next local midnight.
- Pose: awake (open pill eyes), a gentle head tilt, and one small wave of the right wing when the invite appears, then still. Instant under `prefers-reduced-motion`.
- Settings: **"Ask me if I want to start a focus block"** under Buddy, on by default (`settings.askToStart`).

## Rules for every invite

An invite is raised only if all hold: `settings.askToStart`; signed in (`!needsSignIn`); timer `phase === "idle"`; `now >= invite.declinedUntil`; no invite already pending; `!settings.hideEverywhere`.

A pending invite is cleared by any answer, by any `phase-started` timer event, and after 30 minutes unanswered (treated like **Later**, so it does not stay up forever).

## State

- `shared/types.ts`
  - `BuddyAnimationState` gains `"inviting"`.
  - `Transient` gains `inviteSince: number` (0 = none; > 0 = pending since that time).
  - `LocalState` gains `invite: { declinedUntil: number; lastDay: string; lastAt: number; stoppedAt: number }` (`lastDay` is local `YYYY-MM-DD` of the last invite; `lastAt` its time; `stoppedAt` the last Stop, 0 after a phase starts).
  - `Settings` gains `askToStart: boolean`.
- `shared/storage.ts`: defaults `askToStart: true`, `invite: { declinedUntil: 0, lastDay: "", lastAt: 0, stoppedAt: 0 }`, `transient.inviteSince: 0`.
- `shared/messages.ts`: command `{ type: "invite/answer"; choice: "start" | "later" | "notToday" }` (not gated).

## Pure logic (TDD) — `features/buddy/invite.ts`

- `localDay(nowMs): string` (local `YYYY-MM-DD`).
- `nextLocalMidnight(nowMs): number`.
- `inviteDue(input, trigger): boolean` where `input = { now, askToStart, hideEverywhere, signedIn, timerIdle, invite, inviteSince, lastActivityAt }` and `trigger` is `"day" | "afterStop" | "idle"`:
  - common gates as above;
  - `day`: `invite.lastDay !== localDay(now)`;
  - `afterStop`: `invite.stoppedAt > 0 && now - invite.stoppedAt >= 10 min`;
  - `idle`: `now - lastActivityAt >= 45 min && now - invite.lastAt >= 45 min`.
- `inviteExpired(inviteSince, now)`: pending and `now - inviteSince >= 30 min`.
- `answerInvite(choice, now)`: returns the new `invite.declinedUntil` (`later`: now + 30 min; `notToday`: next local midnight; `start`: unchanged).
- `lastActivityAt` = the latest `endedAt` in `local.sessions`, or `phaseStartedAt`, or 0.
- `deriveBuddyState`: precedence becomes celebrating > nudging > **inviting** (`transient.inviteSince > 0`) > work/focus > break > idle. Update its tests.

Tests: `tests/features/buddy/invite.test.ts` (each gate, each trigger at the boundary minute, midnight rollover, expiry), plus new cases in the existing buddy-state tests.

## Worker — `features/buddy/worker.ts` (worker-only)

- `raiseInvite(now)`: inside the queue; sets `transient.inviteSince = now`, `invite.lastDay = localDay(now)`, `invite.lastAt = now`.
- `clearInvite()`: `transient.inviteSince = 0`.
- Day trigger: in `worker/state-port.ts`, when a buddy port connects, enqueue a check for `"day"` (the snapshot push that follows shows it).
- Alarm `invite-check`, every 5 minutes (register in `reconcile` so it survives restarts): in the queue, expire a stale invite, else check `"afterStop"` then `"idle"`.
- Timer events (`onTimerEvent` in `entrypoints/background.ts` or the buddy worker): `stopped` → `invite.stoppedAt = now`; `phase-started` → `invite.stoppedAt = 0` and `clearInvite()`.
- Handler `invite/answer`: clear the invite; set `invite.declinedUntil = answerInvite(choice, now)`.
- Snapshot (`state-port.ts`): add `invite: boolean` to `BuddySnapshot`.

## UI

- `ui/components/Buddy.tsx` + `Buddy.css`: `inviting` label "Plover wants to start with you"; pill eyes (as working); head group tilted about 8° (transform-origin at the body centre); right wing waves twice (≈ 0.5 s each) on entering the state, then rests. No new colours; respect `prefers-reduced-motion`. **Only add the `--inviting` rules; do not change other states** (the onboarding work in another thread also uses this component).
- `entrypoints/content/BuddyView.tsx` + `buddy.css`: when `snap.invite`, the bubble shows "Want to start a focus block?" and three buttons: **Start** (brand), **Later**, **Not today** (text buttons). Start sends `invite/answer start` then opens the panel; the others send their answer. Buttons are real `<button>`s, keyboard reachable, and the bubble keeps the corner logic (`plover-below`). The invite bubble wins over the nudge text only when no check-in is pending (check-in > nudge > invite).
- Options page, Buddy section: a toggle **Ask me if I want to start a focus block** bound to `settings.askToStart`.

## Docs

`docs/DESIGN.md`: §4.1 (new state, triggers, answers, precedence), §3 types, §4.11 settings row, §11 history line. Delete this plan in the PR that finishes it.

## Tasks

1. **Logic** (types, storage, invite.ts + tests, buddy-state + tests, worker, alarm, timer hooks, command, snapshot, DESIGN §3/§4.1).
2. **UI** (Buddy pose, bubble with buttons, settings toggle, DESIGN §4.11). Depends on 1.

## Verification

`pnpm typecheck && pnpm lint && pnpm test`; build; load a copy with `host_permissions: ["<all_urls>"]` in Playwright; seed state to show the invite on a page; screenshot the pose and bubble in both corners and both themes; click each answer and check `invite.declinedUntil` and that Start opens the panel.

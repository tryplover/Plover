# Activity Bus-Subscriber Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 7 near-identical activity bus-subscriber classes (each in its own subfolder) with a data-driven spec registry + one shared factory, preserving the `google/`/`github/` domain grouping.

**Architecture:** Each of the 7 subscribers is functionally identical: subscribe to a bus event, and if a settings gate is on, write the payload to `ActivityRepo.log(kind, {...payload})`. Collapse them into (a) a shared `createActivitySubscribers(specs, deps)` factory returning `{ start, stop }`, and (b) two per-domain spec tables. `index.ts` wires one combined group instead of 7 objects.

**Tech Stack:** TypeScript (strict, NodeNext ESM — imports use `.js`), Vitest, better-sqlite3 (`:memory:` in tests), the in-process `TypedEventBus`.

## Global Constraints

- TypeScript strict: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Do not loosen.
- No comments unless the WHY is non-obvious. No `any` — use precise types/casts.
- ESM: every relative import ends in `.js`; alias imports use `@main/*` and `@shared/*`.
- No behavior change: identical channels, gates, `kind` strings, and logged payloads.
- Verify with `pnpm typecheck && pnpm lint && pnpm --filter ./app run test` from repo root; the pre-existing renderer failures (`App`/`Home`/`Onboarding`, documented in `plover-testing`) are the only acceptable red.

## Variance table (the entire spec surface)

| event (channel) | gate (BoolKeyOf<SettingsData>) | kind |
|---|---|---|
| `gmail.message` | `gmailEnabled` | `gmail_message` |
| `calendar.event` | `calendarEnabled` | `calendar_event` |
| `classroom.coursework` | `classroomEnabled` | `classroom_coursework` |
| `gdocs.revision` | `gdocsPollingEnabled` | `gdocs_revision` |
| `github.commit` | `githubTrackingEnabled` | `github_commit` |
| `github.pr` | `githubTrackingEnabled` | `github_pr` |
| `github.review` | `githubTrackingEnabled` | `github_review` |

`gdocs`'s old handler listed `{ fileId, name, modifiedTime, revisionId }` — that is the entire `GDocsRevisionPayload`, so `{ ...payload }` is equivalent. No transform variance exists.

## File structure

- Create `app/src/main/activity/sources/activity-subscriber.ts` — `SubscriberSpec` type, `ActivitySubscriberDeps`, `ActivitySubscriberGroup`, `createActivitySubscribers`.
- Create `app/src/main/activity/sources/google/subscribers.ts` — `GOOGLE_SUBSCRIBER_SPECS`.
- Create `app/src/main/activity/sources/github/subscribers.ts` — `GITHUB_SUBSCRIBER_SPECS`.
- Create `app/tests/activity/activity-subscribers.test.ts` — consolidated data-driven test.
- Modify `app/src/main/activity/index.ts` — replace 7 subscriber import/field/start/stop blocks with one group.
- Delete 7 subfolders: `sources/google/{gmail,calendar,classroom,gdocs}-subscriber/`, `sources/github/{github-commit,github-pr,github-review}-subscriber/`.
- Delete 7 tests: `tests/activity/{gmail,calendar,classroom,gdocs,github-commit,github-pr,github-review}-subscriber.test.ts`.

---

### Task 1: Shared factory + per-domain spec registries (TDD)

**Files:**
- Create: `app/src/main/activity/sources/activity-subscriber.ts`
- Create: `app/src/main/activity/sources/google/subscribers.ts`
- Create: `app/src/main/activity/sources/github/subscribers.ts`
- Test: `app/tests/activity/activity-subscribers.test.ts`

**Interfaces:**
- Produces:
  - `type SubscriberSpec = { event: keyof EventPayloads; gate: <bool settings key>; kind: string }`
  - `interface ActivitySubscriberDeps { activityRepo: ActivityRepo; settingsRepo: SettingsRepo; eventBus: TypedEventBus }`
  - `interface ActivitySubscriberGroup { start(): void; stop(): void }`
  - `createActivitySubscribers(specs: readonly SubscriberSpec[], deps: ActivitySubscriberDeps): ActivitySubscriberGroup`
  - `GOOGLE_SUBSCRIBER_SPECS: readonly SubscriberSpec[]`, `GITHUB_SUBSCRIBER_SPECS: readonly SubscriberSpec[]`

- [ ] **Step 1: Write the failing test** — `app/tests/activity/activity-subscribers.test.ts`

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('keytar');
vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/test') } }));

import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/events/bus';
import type { EventPayloads } from '../../src/shared/events';
import { createActivitySubscribers } from '../../src/main/activity/sources/activity-subscriber';
import { GOOGLE_SUBSCRIBER_SPECS } from '../../src/main/activity/sources/google/subscribers';
import { GITHUB_SUBSCRIBER_SPECS } from '../../src/main/activity/sources/github/subscribers';

const SAMPLE_PAYLOADS: { [E in keyof EventPayloads]?: EventPayloads[E] } = {
  'gmail.message': { id: 'm1', threadId: 't1', from: 'a@b.com', subject: 'Hi', snippet: 's', labels: ['INBOX'], receivedAt: '2026-08-04T00:00:00.000Z' },
  'calendar.event': { id: 'c1', title: 'Standup', start: '2026-08-04T09:00:00.000Z', end: '2026-08-04T09:15:00.000Z', status: 'confirmed', attendeeCount: 3, location: null },
  'classroom.coursework': { courseId: 'co1', courseName: 'Math', id: 'cw1', title: 'HW1', dueDate: null, state: 'PUBLISHED' },
  'gdocs.revision': { fileId: 'f1', name: 'Doc', modifiedTime: '2026-08-04T00:00:00.000Z', revisionId: 'r1' },
  'github.commit': { repo: 'o/r', sha: 'abc', message: 'msg', author: 'me', url: 'https://x', committedAt: '2026-08-04T00:00:00.000Z' },
  'github.pr': { repo: 'o/r', number: 1, title: 'PR', state: 'open', action: 'opened', url: 'https://x', updatedAt: '2026-08-04T00:00:00.000Z' },
  'github.review': { repo: 'o/r', prNumber: 1, kind: 'reviewed', url: 'https://x', updatedAt: '2026-08-04T00:00:00.000Z' },
};

const ALL_SPECS = [...GOOGLE_SUBSCRIBER_SPECS, ...GITHUB_SUBSCRIBER_SPECS];

describe('activity bus subscribers', () => {
  let db: Database.Database;
  let activity: ActivityRepo;
  let settings: SettingsRepo;
  let bus: TypedEventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    runMigrations(db);
    activity = new ActivityRepo(db);
    settings = new SettingsRepo(db);
    bus = new TypedEventBus();
  });

  it('has a sample payload for every registered spec', () => {
    for (const spec of ALL_SPECS) {
      expect(SAMPLE_PAYLOADS[spec.event], `missing SAMPLE_PAYLOADS for ${spec.event}`).toBeDefined();
    }
  });

  for (const spec of ALL_SPECS) {
    it(`logs ${spec.kind} on ${spec.event} when enabled`, () => {
      settings.update({ [spec.gate]: true, pauseAllTracking: false } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], { activityRepo: activity, settingsRepo: settings, eventBus: bus });
      group.start();
      bus.emit(spec.event, SAMPLE_PAYLOADS[spec.event]!);
      expect(activity.list({ kind: spec.kind })).toHaveLength(1);
    });

    it(`suppresses ${spec.kind} when its gate is off`, () => {
      settings.update({ [spec.gate]: false, pauseAllTracking: false } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], { activityRepo: activity, settingsRepo: settings, eventBus: bus });
      group.start();
      bus.emit(spec.event, SAMPLE_PAYLOADS[spec.event]!);
      expect(activity.list({ kind: spec.kind })).toHaveLength(0);
    });

    it(`suppresses ${spec.kind} when pauseAllTracking is set`, () => {
      settings.update({ [spec.gate]: true, pauseAllTracking: true } as Record<string, boolean>);
      const group = createActivitySubscribers([spec], { activityRepo: activity, settingsRepo: settings, eventBus: bus });
      group.start();
      bus.emit(spec.event, SAMPLE_PAYLOADS[spec.event]!);
      expect(activity.list({ kind: spec.kind })).toHaveLength(0);
    });
  }

  it('stop() unsubscribes so later emits are ignored', () => {
    const spec = ALL_SPECS[0]!;
    settings.update({ [spec.gate]: true, pauseAllTracking: false } as Record<string, boolean>);
    const group = createActivitySubscribers([spec], { activityRepo: activity, settingsRepo: settings, eventBus: bus });
    group.start();
    group.stop();
    bus.emit(spec.event, SAMPLE_PAYLOADS[spec.event]!);
    expect(activity.list({ kind: spec.kind })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/activity/activity-subscribers.test.ts`
Expected: FAIL — cannot resolve `activity-subscriber` / `subscribers` modules.

- [ ] **Step 3: Create the factory** — `app/src/main/activity/sources/activity-subscriber.ts`

```ts
import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo, SettingsData } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import { EventPayloads } from '@shared/events.js';
import { gate } from '@main/activity/shared/gate.js';

type BoolKeyOf<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];

export interface SubscriberSpec {
  event: keyof EventPayloads;
  gate: BoolKeyOf<SettingsData>;
  kind: string;
}

export interface ActivitySubscriberDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  eventBus: TypedEventBus;
}

export interface ActivitySubscriberGroup {
  start(): void;
  stop(): void;
}

export function createActivitySubscribers(
  specs: readonly SubscriberSpec[],
  deps: ActivitySubscriberDeps,
): ActivitySubscriberGroup {
  const bound = specs.map((spec) => {
    const handler = (payload: EventPayloads[keyof EventPayloads]): void => {
      if (!gate(deps.settingsRepo, spec.gate)) return;
      deps.activityRepo.log(spec.kind, { ...payload });
    };
    return { spec, handler };
  });

  return {
    start(): void {
      for (const { spec, handler } of bound) deps.eventBus.on(spec.event, handler);
    },
    stop(): void {
      for (const { spec, handler } of bound) deps.eventBus.off(spec.event, handler);
    },
  };
}
```

Note on typing: `bus.on/off` are `<K extends keyof EventPayloads>(event, (p: EventPayloads[K]) => void)`. Passing the union `spec.event` with a handler typed `(p: EventPayloads[keyof EventPayloads]) => void` should typecheck as-is. If strict TS rejects the correlated union, cast **only the handler** at the boundary (no `any`):
`deps.eventBus.on(spec.event, handler as (p: EventPayloads[typeof spec.event]) => void);` (same for `off`). Do not change `bus.ts`.

- [ ] **Step 4: Create the Google registry** — `app/src/main/activity/sources/google/subscribers.ts`

```ts
import { SubscriberSpec } from '../activity-subscriber.js';

export const GOOGLE_SUBSCRIBER_SPECS: readonly SubscriberSpec[] = [
  { event: 'gmail.message', gate: 'gmailEnabled', kind: 'gmail_message' },
  { event: 'calendar.event', gate: 'calendarEnabled', kind: 'calendar_event' },
  { event: 'classroom.coursework', gate: 'classroomEnabled', kind: 'classroom_coursework' },
  { event: 'gdocs.revision', gate: 'gdocsPollingEnabled', kind: 'gdocs_revision' },
];
```

- [ ] **Step 5: Create the GitHub registry** — `app/src/main/activity/sources/github/subscribers.ts`

```ts
import { SubscriberSpec } from '../activity-subscriber.js';

export const GITHUB_SUBSCRIBER_SPECS: readonly SubscriberSpec[] = [
  { event: 'github.commit', gate: 'githubTrackingEnabled', kind: 'github_commit' },
  { event: 'github.pr', gate: 'githubTrackingEnabled', kind: 'github_pr' },
  { event: 'github.review', gate: 'githubTrackingEnabled', kind: 'github_review' },
];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter ./app exec vitest run tests/activity/activity-subscribers.test.ts`
Expected: PASS (all loop cases + guard + stop).

If the `settings.update({ [spec.gate]: ... } as Record<string, boolean>)` cast is rejected by `SettingsRepo.update`'s param type, adjust the cast to `as Partial<SettingsData>` — check the signature in `app/src/main/store/repos/settings.ts`.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean (exit 0).

- [ ] **Step 8: Commit**

```bash
git add app/src/main/activity/sources/activity-subscriber.ts \
        app/src/main/activity/sources/google/subscribers.ts \
        app/src/main/activity/sources/github/subscribers.ts \
        app/tests/activity/activity-subscribers.test.ts
git commit -m "refactor(activity): add data-driven bus-subscriber factory + domain registries"
```

---

### Task 2: Rewire `index.ts` and delete the old subscriber files

**Files:**
- Modify: `app/src/main/activity/index.ts`
- Delete: 7 subfolders + 7 test files (see File structure).

**Interfaces:**
- Consumes: `createActivitySubscribers`, `ActivitySubscriberGroup`, `GOOGLE_SUBSCRIBER_SPECS`, `GITHUB_SUBSCRIBER_SPECS` from Task 1.

- [ ] **Step 1: Replace the 7 subscriber imports (lines 3–9)** with:

```ts
import {
  createActivitySubscribers,
  ActivitySubscriberGroup,
} from './sources/activity-subscriber.js';
import { GOOGLE_SUBSCRIBER_SPECS } from './sources/google/subscribers.js';
import { GITHUB_SUBSCRIBER_SPECS } from './sources/github/subscribers.js';
```

Leave the `WindowTracker` (line 2), `ScreenCapturer`, `FolderWatcher`, `InferenceEngine`, `GitCommitTracker`, `CommitTaskMatcher`, `runRetention` imports untouched.

- [ ] **Step 2: Replace the 7 module-level `let` declarations (lines 20–26)** with a single:

```ts
let busSubscribers: ActivitySubscriberGroup | null = null;
```

- [ ] **Step 3: Replace the 7 `if (!xSubscriber) { ... }` init blocks (lines 46–79)** with:

```ts
  if (!busSubscribers) {
    busSubscribers = createActivitySubscribers(
      [...GOOGLE_SUBSCRIBER_SPECS, ...GITHUB_SUBSCRIBER_SPECS],
      { activityRepo, settingsRepo, eventBus },
    );
    busSubscribers.start();
  }
```

- [ ] **Step 4: Replace the 7 stop blocks (lines 157–184)** with:

```ts
  if (busSubscribers) {
    busSubscribers.stop();
    busSubscribers = null;
  }
```

Keep the `windowTracker` and `screenCapturer` stop blocks and all other stop logic.

- [ ] **Step 5: Delete the old subscriber source subfolders**

```bash
git rm -r app/src/main/activity/sources/google/gmail-subscriber \
          app/src/main/activity/sources/google/calendar-subscriber \
          app/src/main/activity/sources/google/classroom-subscriber \
          app/src/main/activity/sources/google/gdocs-subscriber \
          app/src/main/activity/sources/github/github-commit-subscriber \
          app/src/main/activity/sources/github/github-pr-subscriber \
          app/src/main/activity/sources/github/github-review-subscriber
```

- [ ] **Step 6: Delete the 7 old test files**

```bash
git rm app/tests/activity/gmail-subscriber.test.ts \
       app/tests/activity/calendar-subscriber.test.ts \
       app/tests/activity/classroom-subscriber.test.ts \
       app/tests/activity/gdocs-subscriber.test.ts \
       app/tests/activity/github-commit-subscriber.test.ts \
       app/tests/activity/github-pr-subscriber.test.ts \
       app/tests/activity/github-review-subscriber.test.ts
```

- [ ] **Step 7: Confirm no stale references remain**

Run: `grep -rn "ActivitySubscriber\b\|-subscriber/" app/src app/tests --include='*.ts'`
Expected: only hits are the new `activity-subscriber.ts` / registry imports; NO reference to a deleted `*-subscriber/` folder or a `GmailActivitySubscriber`-style class.

- [ ] **Step 8: Verify green**

Run: `pnpm typecheck && pnpm lint && pnpm --filter ./app run test`
Expected: typecheck/lint clean; the only test failures are the pre-existing renderer ones (`App`/`Home`/`Onboarding`). All `tests/activity/**` pass. Confirm with:
`pnpm --filter ./app exec vitest run tests/activity`
Expected: all activity test files pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(activity): wire subscriber registry into index, drop per-source files"
```

---

## Self-review notes

- **Spec coverage:** all 7 rows of the variance table appear in the two registry files (Task 1 steps 4–5) and are exercised by the loop test (Task 1 step 1). `index.ts` wiring + deletions in Task 2 cover the "collapse subfolders" goal.
- **Non-goals honored:** `git-commit-tracker`, `folder-watcher`, `window-tracker`, `screen-capturer`, `inference`, `retention`, `commit-task-matcher` are not touched.
- **Type consistency:** `SubscriberSpec`, `ActivitySubscriberGroup`, `createActivitySubscribers`, `GOOGLE_SUBSCRIBER_SPECS`, `GITHUB_SUBSCRIBER_SPECS` names are identical across the factory, registries, `index.ts`, and test.
- **Single atomic PR** (not a stack): the factory is unused until `index.ts` is rewired and the old files deleted, so Task 1 and Task 2 must ship together to keep the tree green.

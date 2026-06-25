# Screen Tracking Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the activity-tracking subsystem started in Phase 1 — add opt-in screenshot capture (with Gemini Vision inference), richer window metadata, a renderer activity-timeline view, planner activity context, and retention controls.

**Architecture:** A new `ScreenCapturer` joins the existing `WindowTracker` + `GDocsPoller` under `app/src/main/activity/`. New Settings keys gate every capture path; default-off for anything that requires a new macOS permission. The renderer gains an "Activity" page reading from a new `activity:*` IPC surface. The backend proxy gains `/api/infer-screen` (Gemini Vision) and accepts an optional `recentActivity` in `/api/decompose`.

**Tech Stack:** Electron 33 (`desktopCapturer`, `systemPreferences`), TypeScript strict, better-sqlite3, React 18, Express + `@google/generative-ai` on the backend, Vitest. macOS-only for screenshot capture in v1.

**Spec:** [docs/superpowers/specs/phase-2/features/screen-tracking.md](../superpowers/specs/phase-2/features/screen-tracking.md)

## Global Constraints

- **Module boundaries.** New activity producers write to `ActivityRepo` only. They never read other tables. Backend proxy is the **only** module that talks to Gemini.
- **Permissions default off.** macOS Screen Recording is requested only when the user toggles `screenCaptureEnabled` on. No keystroke / Accessibility permission anywhere in this plan.
- **Privacy ceiling.** Screenshot bytes never leave the device unless `screenVisionInferenceEnabled` is true. Default is false.
- **Outbound HTTP allowlist.** No new hosts added. Vision requests go through the existing backend proxy (`PLOVER_BACKEND_URL`).
- **Local-only data.** New event kinds (`screenshot_captured`, `screenshot_inferred`) join the existing `activity` table. PNG files go under `app.getPath('userData')/screenshots/YYYY/MM/DD/<uuid>.png`. No new tables.
- **Macro / TS strict.** Don't loosen `noUncheckedIndexedAccess` or `noImplicitOverride`. New code is `import.meta.dirname`-friendly; no `__dirname` shims.
- **Tests.** TDD for `ScreenCapturer`, `WindowTracker` extensions, backend `/api/infer-screen`, planner context plumbing, IPC handlers. UI scaffolding is exempt — smoke-render only. No real network in tests (mock or `nock`).
- **Verification.** After every task: `pnpm typecheck && pnpm lint && pnpm test` must pass at the repo root.

## File structure

```
app/src/main/
  activity/
    screen-capturer.ts            NEW
    window-tracker.ts             MODIFY (bundleId + browser URL)
    index.ts                      MODIFY (wire ScreenCapturer)
    retention.ts                  NEW
  store/repos/
    settings.ts                   MODIFY (new toggles + retention)
    activity.ts                   MODIFY (purge + getById)
  permissions/
    screen-recording.ts           NEW
  ipc.ts                          MODIFY (new handlers)
  planner/
    decompose.ts                  MODIFY (recentActivity param)
  paths.ts                        NEW (userData helpers if not present)

app/src/preload/
  index.ts                        MODIFY (expose activity:*, permissions:*)

app/src/renderer/main/
  pages/
    Activity.tsx                  NEW
    Settings.tsx                  MODIFY (tracking panel)
  components/
    ActivityRow.tsx               NEW
    ScreenshotPreview.tsx         NEW
  App.tsx                         MODIFY (route)
  global.d.ts                     MODIFY (typed PloverApi extension)

app/tests/
  activity/
    screen-capturer.test.ts       NEW
    window-tracker.test.ts        MODIFY / NEW
    retention.test.ts             NEW
  permissions/
    screen-recording.test.ts      NEW
  ipc/
    activity-ipc.test.ts          NEW
  planner/
    decompose.test.ts             MODIFY (recentActivity in prompt)

server/src/
  index.ts                        MODIFY (/api/infer-screen, /api/decompose ext)

server/test/
  infer-screen.test.ts            NEW
  decompose-context.test.ts       NEW
```

---

## Task 1: Settings — Activity tracking keys

**Files:**
- Modify: `app/src/main/store/repos/settings.ts`
- Test: `app/tests/store/settings-repo.test.ts` (extend if present; create otherwise)

**Interfaces:**
- Produces: extended `SettingsData` with `pauseAllTracking`, `windowTrackingEnabled`, `gdocsPollingEnabled`, `fileWatchingEnabled`, `screenCaptureEnabled`, `screenCaptureIntervalMinutes`, `screenVisionInferenceEnabled`, `activityRetentionDays`, `planner_useRecentActivityContext`.

- [ ] **Step 1: Write failing tests for new defaults + roundtrip**

```ts
// app/tests/store/settings-repo.test.ts (add)
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';

describe('SettingsRepo — Phase 2 activity tracking keys', () => {
  let db: Database.Database;
  let repo: SettingsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SettingsRepo(db);
  });

  it('returns the documented defaults when nothing is stored', () => {
    const s = repo.getAll();
    expect(s.pauseAllTracking).toBe(false);
    expect(s.windowTrackingEnabled).toBe(true);
    expect(s.gdocsPollingEnabled).toBe(true);
    expect(s.fileWatchingEnabled).toBe(true);
    expect(s.screenCaptureEnabled).toBe(false);
    expect(s.screenCaptureIntervalMinutes).toBe(5);
    expect(s.screenVisionInferenceEnabled).toBe(false);
    expect(s.activityRetentionDays).toBe(30);
    expect(s.planner_useRecentActivityContext).toBe(true);
  });

  it('roundtrips updated activity keys', () => {
    repo.update({
      screenCaptureEnabled: true,
      screenCaptureIntervalMinutes: 10,
      screenVisionInferenceEnabled: true,
      activityRetentionDays: 7,
      pauseAllTracking: true,
      planner_useRecentActivityContext: false,
    });
    const s = repo.getAll();
    expect(s.screenCaptureEnabled).toBe(true);
    expect(s.screenCaptureIntervalMinutes).toBe(10);
    expect(s.screenVisionInferenceEnabled).toBe(true);
    expect(s.activityRetentionDays).toBe(7);
    expect(s.pauseAllTracking).toBe(true);
    expect(s.planner_useRecentActivityContext).toBe(false);
  });

  it('clamps screenCaptureIntervalMinutes to [1, 60]', () => {
    repo.update({ screenCaptureIntervalMinutes: 0 });
    expect(repo.getAll().screenCaptureIntervalMinutes).toBe(1);
    repo.update({ screenCaptureIntervalMinutes: 999 });
    expect(repo.getAll().screenCaptureIntervalMinutes).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter ./app run test -- settings-repo.test.ts
```
Expected: FAIL — properties undefined.

- [ ] **Step 3: Extend `SettingsData` and the repo**

```ts
// app/src/main/store/repos/settings.ts
export interface SettingsData {
  googleConnected: boolean;
  workingHours: { start: string; end: string };
  horizonDays: number;
  pauseScheduling: boolean;
  watchedFolders: string[];
  lastInferenceTs: string | null;

  pauseAllTracking: boolean;
  windowTrackingEnabled: boolean;
  gdocsPollingEnabled: boolean;
  fileWatchingEnabled: boolean;
  screenCaptureEnabled: boolean;
  screenCaptureIntervalMinutes: number;
  screenVisionInferenceEnabled: boolean;
  activityRetentionDays: number;
  planner_useRecentActivityContext: boolean;
}

// In getAll(), add (after existing reads):
const pauseAllTracking = this.get('pauseAllTracking') === 'true';
const windowTrackingEnabled = this.get('windowTrackingEnabled') !== 'false';
const gdocsPollingEnabled = this.get('gdocsPollingEnabled') !== 'false';
const fileWatchingEnabled = this.get('fileWatchingEnabled') !== 'false';
const screenCaptureEnabled = this.get('screenCaptureEnabled') === 'true';
const rawInterval = Number(this.get('screenCaptureIntervalMinutes') ?? '5');
const screenCaptureIntervalMinutes = Math.min(60, Math.max(1, Number.isFinite(rawInterval) ? Math.round(rawInterval) : 5));
const screenVisionInferenceEnabled = this.get('screenVisionInferenceEnabled') === 'true';
const rawRetention = Number(this.get('activityRetentionDays') ?? '30');
const activityRetentionDays = Math.max(0, Number.isFinite(rawRetention) ? Math.round(rawRetention) : 30);
const planner_useRecentActivityContext = this.get('planner_useRecentActivityContext') !== 'false';
```

Add corresponding `update()` branches that write each key via `this.set(...)`. For `screenCaptureIntervalMinutes`, clamp before storing:

```ts
if (patch.screenCaptureIntervalMinutes !== undefined) {
  const clamped = Math.min(60, Math.max(1, Math.round(patch.screenCaptureIntervalMinutes)));
  this.set('screenCaptureIntervalMinutes', String(clamped));
}
```

Booleans use `String(true)` / `String(false)`. `activityRetentionDays` writes `Math.max(0, Math.round(...))` as a string.

Return the new fields in the `getAll()` return object.

- [ ] **Step 4: Run tests to verify pass**

```
pnpm --filter ./app run test -- settings-repo.test.ts
```
Expected: PASS.

- [ ] **Step 5: Typecheck/lint and commit**

```
pnpm typecheck && pnpm lint
git add app/src/main/store/repos/settings.ts app/tests/store/settings-repo.test.ts
git commit -m "feat(settings): add Phase 2 activity-tracking keys and defaults"
```

---

## Task 2: Activity IPC + retention helper

**Files:**
- Create: `app/src/main/activity/retention.ts`
- Modify: `app/src/main/store/repos/activity.ts` (add `purge`, `getById`)
- Modify: `app/src/main/ipc.ts` (handlers `activity:list`, `activity:purge`, `activity:getById`)
- Modify: `app/src/preload/index.ts` (expose new methods + types)
- Modify: `app/src/renderer/main/global.d.ts` (typed PloverApi additions)
- Test: `app/tests/store/activity-repo.test.ts` (extend / create), `app/tests/activity/retention.test.ts`, `app/tests/ipc/activity-ipc.test.ts`

**Interfaces:**
- Consumes: `ActivityRepo` from Task 1's settings (`activityRetentionDays`).
- Produces:
  - `ActivityRepo.purge({ olderThan?: string; ids?: number[] }): { deleted: number }`
  - `ActivityRepo.getById(id: number): ActivityRow | null`
  - IPC `activity:list({ since?, until?, kinds?, limit?, offset? }) → ActivityRow[]`
  - IPC `activity:purge({ olderThan?, ids? }) → { deleted: number }`
  - IPC `activity:getById(id: number) → ActivityRow | null`
  - `runRetention(repo: ActivityRepo, settingsRepo: SettingsRepo, now: Date): { deleted: number; cutoff: string | null }`

- [ ] **Step 1: Write failing tests for `purge` and `getById`**

```ts
// app/tests/store/activity-repo.test.ts (add)
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { ActivityRepo } from '../../src/main/store/repos/activity.js';
import { runMigrations } from '../../src/main/store/db.js';

describe('ActivityRepo — purge + getById', () => {
  let db: Database.Database;
  let repo: ActivityRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new ActivityRepo(db);
  });

  it('purges rows older than a cutoff', () => {
    repo.insert({ kind: 'window_focus', payload: { app: 'A' }, ts: '2026-01-01T00:00:00.000Z' });
    repo.insert({ kind: 'window_focus', payload: { app: 'B' }, ts: '2026-02-01T00:00:00.000Z' });
    repo.insert({ kind: 'window_focus', payload: { app: 'C' }, ts: '2026-03-01T00:00:00.000Z' });
    const { deleted } = repo.purge({ olderThan: '2026-02-15T00:00:00.000Z' });
    expect(deleted).toBe(2);
    expect(repo.list()).toHaveLength(1);
  });

  it('purges specific ids', () => {
    const a = repo.insert({ kind: 'x', payload: {}, ts: '2026-01-01T00:00:00.000Z' });
    const b = repo.insert({ kind: 'x', payload: {}, ts: '2026-01-02T00:00:00.000Z' });
    const c = repo.insert({ kind: 'x', payload: {}, ts: '2026-01-03T00:00:00.000Z' });
    const { deleted } = repo.purge({ ids: [a.id, c.id] });
    expect(deleted).toBe(2);
    expect(repo.list()).toHaveLength(1);
    expect(repo.list()[0]?.id).toBe(b.id);
  });

  it('returns a row by id or null', () => {
    const row = repo.insert({ kind: 'k', payload: { x: 1 }, ts: '2026-01-01T00:00:00.000Z' });
    const fetched = repo.getById(row.id);
    expect(fetched?.id).toBe(row.id);
    expect(fetched?.payload).toEqual({ x: 1 });
    expect(repo.getById(99999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter ./app run test -- activity-repo.test.ts
```
Expected: FAIL — methods undefined.

- [ ] **Step 3: Implement `purge` + `getById` on `ActivityRepo`**

```ts
// app/src/main/store/repos/activity.ts (append methods)
purge(args: { olderThan?: string; ids?: number[] }): { deleted: number } {
  if (args.ids && args.ids.length > 0) {
    const placeholders = args.ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM activity WHERE id IN (${placeholders})`);
    const result = stmt.run(...args.ids);
    return { deleted: Number(result.changes) };
  }
  if (args.olderThan) {
    const stmt = this.db.prepare('DELETE FROM activity WHERE ts < ?');
    const result = stmt.run(args.olderThan);
    return { deleted: Number(result.changes) };
  }
  return { deleted: 0 };
}

getById(id: number): ActivityRow | null {
  const row = this.db
    .prepare('SELECT id, ts, kind, payload FROM activity WHERE id = ?')
    .get(id) as ActivityDbRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    ts: row.ts,
    kind: row.kind,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  };
}
```

Also extend `list` to accept `{ since?, until?, kinds?, limit?, offset? }`:

```ts
list(filter?: { kind?: string; kinds?: string[]; since?: string; until?: string; limit?: number; offset?: number }): ActivityRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.kind) { where.push('kind = ?'); params.push(filter.kind); }
  if (filter?.kinds && filter.kinds.length > 0) {
    where.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
    params.push(...filter.kinds);
  }
  if (filter?.since) { where.push('ts >= ?'); params.push(filter.since); }
  if (filter?.until) { where.push('ts <= ?'); params.push(filter.until); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = filter?.limit ? ` LIMIT ${Math.max(1, Math.min(1000, Math.round(filter.limit)))}` : '';
  const offsetSql = filter?.offset ? ` OFFSET ${Math.max(0, Math.round(filter.offset))}` : '';
  const rows = this.db
    .prepare(`SELECT id, ts, kind, payload FROM activity ${whereSql} ORDER BY ts DESC${limitSql}${offsetSql}`)
    .all(...params) as ActivityDbRow[];
  return rows.map((row) => ({ id: row.id, ts: row.ts, kind: row.kind, payload: JSON.parse(row.payload) as Record<string, unknown> }));
}
```

Keep backwards-compatible: callers passing a string positional `kind` no longer compile. Search for `activityRepo.list(` and adapt any callers to the new object shape. The legacy `listSince` / `listBetween` stay as-is.

- [ ] **Step 4: Write retention helper test**

```ts
// app/tests/activity/retention.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { ActivityRepo } from '../../src/main/store/repos/activity.js';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';
import { runRetention } from '../../src/main/activity/retention.js';
import { promises as fs } from 'node:fs';

describe('runRetention', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
  });

  it('does nothing when retention is 0', async () => {
    settingsRepo.update({ activityRetentionDays: 0 });
    activityRepo.insert({ kind: 'x', payload: {}, ts: '2020-01-01T00:00:00.000Z' });
    const r = await runRetention({ activityRepo, settingsRepo, now: new Date('2026-06-25T00:00:00.000Z') });
    expect(r.deleted).toBe(0);
    expect(r.cutoff).toBeNull();
    expect(activityRepo.list()).toHaveLength(1);
  });

  it('deletes rows older than the cutoff and unlinks orphan screenshot files', async () => {
    const unlinkSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, 'unlink').mockImplementation(unlinkSpy);
    settingsRepo.update({ activityRetentionDays: 30 });
    activityRepo.insert({
      kind: 'screenshot_captured',
      payload: { filePath: '/tmp/plover-screens/old.png', width: 1, height: 1 },
      ts: '2026-01-01T00:00:00.000Z',
    });
    activityRepo.insert({ kind: 'window_focus', payload: { app: 'X', title: 'Y' }, ts: '2026-06-20T00:00:00.000Z' });
    const r = await runRetention({ activityRepo, settingsRepo, now: new Date('2026-06-25T00:00:00.000Z') });
    expect(r.deleted).toBe(1);
    expect(r.cutoff).toBe('2026-05-26T00:00:00.000Z');
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/plover-screens/old.png');
  });
});
```

- [ ] **Step 5: Implement retention helper**

```ts
// app/src/main/activity/retention.ts
import { promises as fs } from 'node:fs';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';

export async function runRetention(args: {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  now: Date;
}): Promise<{ deleted: number; cutoff: string | null }> {
  const days = args.settingsRepo.getAll().activityRetentionDays;
  if (!days || days <= 0) return { deleted: 0, cutoff: null };
  const cutoff = new Date(args.now.getTime() - days * 86400000).toISOString();
  const screenshotsToUnlink = args.activityRepo
    .list({ kinds: ['screenshot_captured'], until: cutoff, limit: 1000 })
    .map((r) => (r.payload as { filePath?: string }).filePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const { deleted } = args.activityRepo.purge({ olderThan: cutoff });
  for (const p of screenshotsToUnlink) {
    try {
      await fs.unlink(p);
    } catch {
      /* file may already be gone — ignore */
    }
  }
  return { deleted, cutoff };
}
```

- [ ] **Step 6: Add IPC handlers**

In `app/src/main/ipc.ts`, near the existing `settings:*` block:

```ts
ipcMain.handle('activity:list', async (_, args: {
  since?: string; until?: string; kinds?: string[]; limit?: number; offset?: number;
}) => activityRepo.list(args ?? {}));

ipcMain.handle('activity:getById', async (_, id: number) => activityRepo.getById(Number(id)));

ipcMain.handle('activity:purge', async (_, args: { olderThan?: string; ids?: number[] }) => {
  if (args?.ids && args.ids.length > 0) {
    const orphanPaths = args.ids
      .map((id) => activityRepo.getById(Number(id)))
      .filter((r): r is NonNullable<typeof r> => !!r && r.kind === 'screenshot_captured')
      .map((r) => (r.payload as { filePath?: string }).filePath)
      .filter((p): p is string => typeof p === 'string');
    const result = activityRepo.purge({ ids: args.ids });
    for (const p of orphanPaths) {
      try { await fs.promises.unlink(p); } catch { /* ignore */ }
    }
    return result;
  }
  return activityRepo.purge(args ?? {});
});
```

Ensure `import * as fs from 'node:fs'` is present at the top of `ipc.ts`. `activityRepo` is already an imported singleton from `./store/index.js`; reuse that import.

- [ ] **Step 7: Expose in preload + typed API**

```ts
// app/src/preload/index.ts — add inside PloverApi
listActivity: (args?: { since?: string; until?: string; kinds?: string[]; limit?: number; offset?: number }) => Promise<Array<{ id: number; ts: string; kind: string; payload: Record<string, unknown> }>>;
getActivityById: (id: number) => Promise<{ id: number; ts: string; kind: string; payload: Record<string, unknown> } | null>;
purgeActivity: (args: { olderThan?: string; ids?: number[] }) => Promise<{ deleted: number }>;

// ...and in the contextBridge object:
listActivity: (args) => ipcRenderer.invoke('activity:list', args ?? {}),
getActivityById: (id) => ipcRenderer.invoke('activity:getById', id),
purgeActivity: (args) => ipcRenderer.invoke('activity:purge', args),
```

Mirror the type extension in `app/src/renderer/main/global.d.ts` if it carries the PloverApi declaration.

- [ ] **Step 8: Verify + commit**

```
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/store/repos/activity.ts app/src/main/activity/retention.ts app/src/main/ipc.ts app/src/preload/index.ts app/src/renderer/main/global.d.ts app/tests/store/activity-repo.test.ts app/tests/activity/retention.test.ts
git commit -m "feat(activity): list/purge/getById IPC and retention helper"
```

---

## Task 3: Enhanced window metadata (bundleId + browser URL)

**Files:**
- Modify: `app/src/main/activity/window-tracker.ts`
- Test: `app/tests/activity/window-tracker.test.ts`

**Interfaces:**
- Consumes: `get-windows` `activeWindow()` result (existing).
- Produces: `window_focus` payloads now shaped `{ app, title, bundleId?, browserUrl?, browserTabTitle? }`.

- [ ] **Step 1: Write failing tests**

```ts
// app/tests/activity/window-tracker.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockActiveWindow = vi.fn();
const mockExecFile = vi.fn();

vi.mock('get-windows', () => ({
  activeWindow: mockActiveWindow,
  openWindows: vi.fn().mockResolvedValue([]),
}));

vi.mock('node:child_process', () => ({
  execFile: (cmd: string, args: string[], opts: object, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    mockExecFile(cmd, args, opts, cb);
  },
}));

import { ActivityRepo } from '../../src/main/store/repos/activity.js';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';
import { WindowTracker } from '../../src/main/activity/window-tracker.js';

describe('WindowTracker — enhanced metadata', () => {
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let tracker: WindowTracker;
  const realPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    tracker = new WindowTracker(activityRepo, settingsRepo);
    mockActiveWindow.mockReset();
    mockExecFile.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('logs bundleId from get-windows owner', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap' },
      title: '#engineering',
    });
    await tracker.checkActiveWindow();
    const rows = activityRepo.list();
    expect(rows[0]?.payload.bundleId).toBe('com.tinyspeck.slackmacgap');
  });

  it('captures browser URL for Chrome via osascript', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Google Chrome', bundleId: 'com.google.Chrome' },
      title: 'Plover - GitHub',
    });
    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, cb) =>
      cb(null, 'https://github.com/foo/plover\nPlover · GitHub', '')
    );
    await tracker.checkActiveWindow();
    const payload = activityRepo.list()[0]?.payload as Record<string, unknown>;
    expect(payload.browserUrl).toBe('https://github.com/foo/plover');
    expect(payload.browserTabTitle).toBe('Plover · GitHub');
  });

  it('omits browser fields cleanly when osascript fails', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Safari', bundleId: 'com.apple.Safari' },
      title: 'Some Page',
    });
    mockExecFile.mockImplementationOnce((_cmd, _args, _opts, cb) =>
      cb(new Error('not allowed'), '', '')
    );
    await tracker.checkActiveWindow();
    const payload = activityRepo.list()[0]?.payload as Record<string, unknown>;
    expect(payload.app).toBe('Safari');
    expect(payload.browserUrl).toBeUndefined();
  });

  it('does not call osascript for non-browser apps', async () => {
    mockActiveWindow.mockResolvedValue({
      owner: { name: 'Terminal', bundleId: 'com.apple.Terminal' },
      title: 'zsh',
    });
    await tracker.checkActiveWindow();
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter ./app run test -- window-tracker.test.ts
```
Expected: FAIL — payloads do not include `bundleId` / `browserUrl`.

- [ ] **Step 3: Extend `WindowTracker`**

Replace the body of `getActiveWindowFromOS` and `checkActiveWindow` to:

```ts
// app/src/main/activity/window-tracker.ts
import { activeWindow, openWindows } from 'get-windows';
import { execFile } from 'node:child_process';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';

const BROWSER_BUNDLES: Record<string, string> = {
  'com.google.Chrome': 'Google Chrome',
  'com.apple.Safari': 'Safari',
  'com.brave.Browser': 'Brave Browser',
  'company.thebrowser.Browser': 'Arc',
  'org.mozilla.firefox': 'Firefox',
};

interface WindowMeta {
  app: string;
  title: string;
  bundleId?: string;
  browserUrl?: string;
  browserTabTitle?: string;
}

export class WindowTracker {
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private intervalId: NodeJS.Timeout | null = null;
  private lastApp: string | null = null;
  private lastTitle: string | null = null;
  private lastLogTime = 0;
  private isChecking = false;

  constructor(activityRepo: ActivityRepo, settingsRepo: SettingsRepo) {
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
  }

  start(): void {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return;
    if (this.intervalId) return;
    this.intervalId = setInterval(() => { void this.checkActiveWindow(); }, 10000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkActiveWindow(): Promise<void> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return;
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      const settings = this.settingsRepo.getAll();
      if (settings.pauseAllTracking || settings.pauseScheduling || !settings.windowTrackingEnabled) return;

      const meta = await this.getActiveWindowFromOS();
      const now = Date.now();
      const hasChanged = meta.app !== this.lastApp || meta.title !== this.lastTitle;
      const reachedTimeLimit = now - this.lastLogTime >= 60000;
      if (hasChanged || reachedTimeLimit) {
        this.lastApp = meta.app;
        this.lastTitle = meta.title;
        this.lastLogTime = now;
        const payload: Record<string, unknown> = { app: meta.app, title: meta.title };
        if (meta.bundleId) payload.bundleId = meta.bundleId;
        if (meta.browserUrl) payload.browserUrl = meta.browserUrl;
        if (meta.browserTabTitle) payload.browserTabTitle = meta.browserTabTitle;
        this.activityRepo.log('window_focus', payload);
      }
    } catch (err) {
      console.error('Error tracking active window:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private async getActiveWindowFromOS(): Promise<WindowMeta> {
    const result = await activeWindow();
    const app = result?.owner?.name || 'Unknown';
    const title = result?.title || 'Unknown';
    const bundleId =
      (result?.owner as { bundleId?: string } | undefined)?.bundleId ?? undefined;
    let browserUrl: string | undefined;
    let browserTabTitle: string | undefined;
    if (process.platform === 'darwin' && bundleId && BROWSER_BUNDLES[bundleId]) {
      const captured = await this.tryReadBrowserTab(BROWSER_BUNDLES[bundleId]);
      if (captured) { browserUrl = captured.url; browserTabTitle = captured.title; }
    }
    return { app, title, bundleId, browserUrl, browserTabTitle };
  }

  private tryReadBrowserTab(appName: string): Promise<{ url: string; title: string } | null> {
    const script =
      appName === 'Firefox'
        ? 'tell application "Firefox" to get URL of active tab of front window'
        : `tell application "${appName}" to (get URL of active tab of front window) & linefeed & (get title of active tab of front window)`;
    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], { timeout: 1000 }, (err, stdout) => {
        if (err) { resolve(null); return; }
        const text = stdout.toString().trim();
        if (!text) { resolve(null); return; }
        const [url, ...rest] = text.split('\n');
        resolve(url ? { url, title: rest.join(' ').trim() || appName } : null);
      });
    });
  }
}

export async function listActiveWindows(): Promise<{ app: string; title: string }[]> {
  /* unchanged */
  try {
    if (process.platform !== 'darwin' && process.platform !== 'win32') return [];
    const windows = await openWindows();
    return windows
      .filter((w) => (process.platform === 'darwin' ? w.owner?.name !== 'Finder' && w.title !== 'Unknown' : w.owner?.name !== 'explorer' && w.title !== 'Unknown'))
      .map((w) => ({ app: w.owner?.name || 'Unknown', title: w.title || 'Unknown' }));
  } catch (err) {
    console.error('Error listing active windows:', err);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```
pnpm --filter ./app run test -- window-tracker.test.ts
```
Expected: PASS.

- [ ] **Step 5: Verify + commit**

```
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/activity/window-tracker.ts app/tests/activity/window-tracker.test.ts
git commit -m "feat(window-tracker): capture bundleId and browser URL"
```

---

## Task 4: Screen Recording permission module

**Files:**
- Create: `app/src/main/permissions/screen-recording.ts`
- Modify: `app/src/main/ipc.ts` (handlers `permissions:screenRecording:status` + `:request`)
- Modify: `app/src/preload/index.ts` (expose)
- Test: `app/tests/permissions/screen-recording.test.ts`

**Interfaces:**
- Produces:
  - `getScreenRecordingStatus(): 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'`
  - `requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'>` — triggers the OS prompt by attempting a 1×1 capture; returns the post-attempt status.

- [ ] **Step 1: Write failing tests**

```ts
// app/tests/permissions/screen-recording.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getMediaAccessStatus = vi.fn();
const getSources = vi.fn();

vi.mock('electron', () => ({
  systemPreferences: { getMediaAccessStatus },
  desktopCapturer: { getSources },
}));

import {
  getScreenRecordingStatus,
  requestScreenRecording,
} from '../../src/main/permissions/screen-recording.js';

describe('Screen Recording permission', () => {
  const realPlatform = process.platform;
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    getMediaAccessStatus.mockReset();
    getSources.mockReset();
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('reports unsupported on non-darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getScreenRecordingStatus()).toBe('unsupported');
  });

  it('passes through systemPreferences status on darwin', () => {
    getMediaAccessStatus.mockReturnValue('granted');
    expect(getScreenRecordingStatus()).toBe('granted');
    getMediaAccessStatus.mockReturnValue('denied');
    expect(getScreenRecordingStatus()).toBe('denied');
  });

  it('request triggers a tiny capture and returns the post-status', async () => {
    getMediaAccessStatus.mockReturnValueOnce('not-determined').mockReturnValueOnce('granted');
    getSources.mockResolvedValueOnce([]);
    const result = await requestScreenRecording();
    expect(getSources).toHaveBeenCalledWith(expect.objectContaining({ types: ['screen'] }));
    expect(result).toBe('granted');
  });

  it('returns denied when capture throws and status remains denied', async () => {
    getMediaAccessStatus.mockReturnValue('denied');
    getSources.mockRejectedValueOnce(new Error('not allowed'));
    const result = await requestScreenRecording();
    expect(result).toBe('denied');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter ./app run test -- screen-recording.test.ts
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement module**

```ts
// app/src/main/permissions/screen-recording.ts
import { systemPreferences, desktopCapturer } from 'electron';

export type ScreenRecordingStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unsupported';

export function getScreenRecordingStatus(): ScreenRecordingStatus {
  if (process.platform !== 'darwin') return 'unsupported';
  return systemPreferences.getMediaAccessStatus('screen') as ScreenRecordingStatus;
}

export async function requestScreenRecording(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (process.platform !== 'darwin') return 'unsupported';
  try {
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
  } catch {
    /* ignore; we read status next */
  }
  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'granted' ? 'granted' : 'denied';
}
```

- [ ] **Step 4: Add IPC handlers + preload**

```ts
// app/src/main/ipc.ts (near other handlers)
import { getScreenRecordingStatus, requestScreenRecording } from './permissions/screen-recording.js';

ipcMain.handle('permissions:screenRecording:status', () => getScreenRecordingStatus());
ipcMain.handle('permissions:screenRecording:request', async () => requestScreenRecording());
```

```ts
// app/src/preload/index.ts (extend PloverApi)
getScreenRecordingStatus: () => Promise<'granted' | 'denied' | 'not-determined' | 'restricted' | 'unsupported'>;
requestScreenRecording: () => Promise<'granted' | 'denied' | 'unsupported'>;
// in bridge:
getScreenRecordingStatus: () => ipcRenderer.invoke('permissions:screenRecording:status'),
requestScreenRecording: () => ipcRenderer.invoke('permissions:screenRecording:request'),
```

- [ ] **Step 5: Run + commit**

```
pnpm --filter ./app run test -- screen-recording.test.ts
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/permissions app/src/main/ipc.ts app/src/preload/index.ts app/tests/permissions
git commit -m "feat(permissions): wrap macOS Screen Recording status/request"
```

---

## Task 5: `ScreenCapturer` module

**Files:**
- Create: `app/src/main/activity/screen-capturer.ts`
- Modify: `app/src/main/activity/index.ts` (wire it in)
- Test: `app/tests/activity/screen-capturer.test.ts`

**Interfaces:**
- Consumes: `ActivityRepo`, `SettingsRepo`, `userDataDir: string`. Uses `desktopCapturer.getSources({ types: ['screen'] })` + `nativeImage.toPNG()` and `getScreenRecordingStatus()` from Task 4.
- Produces: `screenshot_captured` activity rows with payload `{ filePath, width, height }`.

- [ ] **Step 1: Write failing tests**

```ts
// app/tests/activity/screen-capturer.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const getSources = vi.fn();
const getMediaAccessStatus = vi.fn();

vi.mock('electron', () => ({
  desktopCapturer: { getSources },
  systemPreferences: { getMediaAccessStatus },
}));

import { ActivityRepo } from '../../src/main/store/repos/activity.js';
import { SettingsRepo } from '../../src/main/store/repos/settings.js';
import { runMigrations } from '../../src/main/store/db.js';
import { ScreenCapturer } from '../../src/main/activity/screen-capturer.js';

describe('ScreenCapturer', () => {
  let userDataDir: string;
  let db: Database.Database;
  let activityRepo: ActivityRepo;
  let settingsRepo: SettingsRepo;
  let capturer: ScreenCapturer;
  const realPlatform = process.platform;

  beforeEach(async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plover-cap-'));
    db = new Database(':memory:');
    runMigrations(db);
    activityRepo = new ActivityRepo(db);
    settingsRepo = new SettingsRepo(db);
    capturer = new ScreenCapturer({ activityRepo, settingsRepo, userDataDir, now: () => new Date('2026-06-25T12:34:56.000Z') });
    getSources.mockReset();
    getMediaAccessStatus.mockReset();
    getMediaAccessStatus.mockReturnValue('granted');
  });

  afterEach(async () => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
    await fs.rm(userDataDir, { recursive: true, force: true });
  });

  it('skips when screenCaptureEnabled is false', async () => {
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
    expect(activityRepo.list()).toHaveLength(0);
  });

  it('skips when pauseAllTracking is true even if enabled', async () => {
    settingsRepo.update({ screenCaptureEnabled: true, pauseAllTracking: true });
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
  });

  it('skips when permission is not granted', async () => {
    settingsRepo.update({ screenCaptureEnabled: true });
    getMediaAccessStatus.mockReturnValue('denied');
    const result = await capturer.captureOnce();
    expect(result).toBeNull();
  });

  it('captures, writes PNG, and logs payload on success', async () => {
    settingsRepo.update({ screenCaptureEnabled: true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    getSources.mockResolvedValueOnce([{
      name: 'Entire Screen',
      thumbnail: { toPNG: () => png, getSize: () => ({ width: 1440, height: 900 }) },
    }]);
    const filePath = await capturer.captureOnce();
    expect(filePath).toBeTruthy();
    expect(filePath!).toMatch(/\/screenshots\/2026\/06\/25\/[^/]+\.png$/);
    const onDisk = await fs.readFile(filePath!);
    expect(onDisk.equals(png)).toBe(true);
    const rows = activityRepo.list();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.kind).toBe('screenshot_captured');
    expect(row?.payload).toMatchObject({ filePath, width: 1440, height: 900 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter ./app run test -- screen-capturer.test.ts
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ScreenCapturer`**

```ts
// app/src/main/activity/screen-capturer.ts
import { desktopCapturer } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';
import { getScreenRecordingStatus } from '../permissions/screen-recording.js';

export interface ScreenCapturerDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  userDataDir: string;
  now?: () => Date;
}

export class ScreenCapturer {
  private deps: ScreenCapturerDeps;
  private intervalId: NodeJS.Timeout | null = null;
  private now: () => Date;

  constructor(deps: ScreenCapturerDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  start(): void {
    if (this.intervalId) return;
    const tick = async (): Promise<void> => { try { await this.captureOnce(); } catch (err) { console.error('[ScreenCapturer] capture failed:', err); } };
    const intervalMs = Math.max(1, this.deps.settingsRepo.getAll().screenCaptureIntervalMinutes) * 60 * 1000;
    this.intervalId = setInterval(() => { void tick(); }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  async captureOnce(): Promise<string | null> {
    const settings = this.deps.settingsRepo.getAll();
    if (!settings.screenCaptureEnabled) return null;
    if (settings.pauseAllTracking) return null;
    if (getScreenRecordingStatus() !== 'granted') return null;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const primary = sources[0];
    if (!primary) return null;
    const png = primary.thumbnail.toPNG();
    const size = primary.thumbnail.getSize();
    const now = this.now();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dir = path.join(this.deps.userDataDir, 'screenshots', yyyy, mm, dd);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, png);
    this.deps.activityRepo.log('screenshot_captured', {
      filePath,
      width: size.width,
      height: size.height,
    }, now.toISOString());
    return filePath;
  }
}
```

- [ ] **Step 4: Wire into activity init**

```ts
// app/src/main/activity/index.ts
import { app } from 'electron';
import { WindowTracker } from './window-tracker.js';
import { GDocsPoller } from './gdocs-poller.js';
import { ScreenCapturer } from './screen-capturer.js';
import { settingsRepo, activityRepo } from '../store/index.js';
import { googleAuth } from '../ipc.js';

let windowTracker: WindowTracker | null = null;
let gdocsPoller: GDocsPoller | null = null;
let screenCapturer: ScreenCapturer | null = null;

export function initActivityMonitoring(): void {
  if (process.platform === 'darwin' && !windowTracker) {
    windowTracker = new WindowTracker(activityRepo, settingsRepo);
    windowTracker.start();
  }
  if (!gdocsPoller) {
    gdocsPoller = new GDocsPoller(googleAuth, activityRepo, settingsRepo);
    gdocsPoller.start();
  }
  if (process.platform === 'darwin' && !screenCapturer) {
    screenCapturer = new ScreenCapturer({
      activityRepo,
      settingsRepo,
      userDataDir: app.getPath('userData'),
    });
    if (settingsRepo.getAll().screenCaptureEnabled) screenCapturer.start();
  }
}

export function stopActivityMonitoring(): void {
  if (windowTracker) { windowTracker.stop(); windowTracker = null; }
  if (gdocsPoller) { gdocsPoller.stop(); gdocsPoller = null; }
  if (screenCapturer) { screenCapturer.stop(); screenCapturer = null; }
}

export function getScreenCapturer(): ScreenCapturer | null { return screenCapturer; }
```

- [ ] **Step 5: Run tests + commit**

```
pnpm --filter ./app run test -- screen-capturer
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/activity/screen-capturer.ts app/src/main/activity/index.ts app/tests/activity/screen-capturer.test.ts
git commit -m "feat(activity): opt-in ScreenCapturer with permission + interval gating"
```

---

## Task 6: Activity timeline view (renderer)

**Files:**
- Create: `app/src/renderer/main/pages/Activity.tsx`
- Create: `app/src/renderer/main/components/ActivityRow.tsx`
- Create: `app/src/renderer/main/components/ScreenshotPreview.tsx`
- Modify: `app/src/renderer/main/App.tsx` (add nav + route)
- Modify: `app/src/main/ipc.ts` — extend `activity:getById` to also return a base64 `dataUrl` for `screenshot_captured` payloads via a sibling handler `activity:getScreenshot`
- Test: `app/tests/renderer/Activity.test.tsx` (smoke)

**Interfaces:**
- Consumes: `window.plover.listActivity`, `window.plover.getActivityById`, new `window.plover.getScreenshot(id) → { dataUrl } | null`.
- Produces: a navigable page displaying activity rows. UI scaffolding — no TDD requirement beyond smoke render.

- [ ] **Step 1: Add `activity:getScreenshot` IPC + preload exposure**

```ts
// app/src/main/ipc.ts (add)
import * as fs from 'node:fs';

ipcMain.handle('activity:getScreenshot', async (_, id: number) => {
  const row = activityRepo.getById(Number(id));
  if (!row || row.kind !== 'screenshot_captured') return null;
  const filePath = (row.payload as { filePath?: string }).filePath;
  if (!filePath) return null;
  try {
    const bytes = await fs.promises.readFile(filePath);
    return { dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
  } catch {
    return null;
  }
});
```

```ts
// app/src/preload/index.ts
getScreenshot: (id: number) => Promise<{ dataUrl: string } | null>;
// in bridge:
getScreenshot: (id) => ipcRenderer.invoke('activity:getScreenshot', id),
```

- [ ] **Step 2: Build the timeline view**

```tsx
// app/src/renderer/main/pages/Activity.tsx
import { useEffect, useState, useCallback } from 'react';
import { ActivityRow } from '../components/ActivityRow.js';

type Row = { id: number; ts: string; kind: string; payload: Record<string, unknown> };
const KINDS_DEFAULT: string[] = [];
const PAGE_SIZE = 100;

export function Activity(): JSX.Element {
  const [rows, setRows] = useState<Row[]>([]);
  const [kinds, setKinds] = useState<string[]>(KINDS_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : rows.length;
    const next = await window.plover.listActivity({
      kinds: kinds.length ? kinds : undefined,
      limit: PAGE_SIZE,
      offset,
    });
    setRows(reset ? next : [...rows, ...next]);
    setDone(next.length < PAGE_SIZE);
    setLoading(false);
  }, [rows, kinds]);

  useEffect(() => { void load(true); }, [kinds]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRow = async (id: number): Promise<void> => {
    await window.plover.purgeActivity({ ids: [id] });
    setRows((r) => r.filter((row) => row.id !== id));
  };

  return (
    <div className="activity-page">
      <header>
        <h1>Activity</h1>
        <KindFilter kinds={kinds} onChange={setKinds} />
      </header>
      <ul className="activity-list">
        {rows.map((r) => (
          <ActivityRow key={r.id} row={r} onDelete={() => deleteRow(r.id)} />
        ))}
      </ul>
      {!done && (
        <button onClick={() => void load(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
      {done && rows.length === 0 && <p className="empty">No activity yet.</p>}
    </div>
  );
}

function KindFilter({ kinds, onChange }: { kinds: string[]; onChange: (k: string[]) => void }): JSX.Element {
  const ALL = ['window_focus', 'gdocs_revision', 'file_modified', 'file_added', 'git_commit', 'screenshot_captured', 'screenshot_inferred'];
  return (
    <div className="kind-filter">
      {ALL.map((k) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={kinds.length === 0 || kinds.includes(k)}
            onChange={(e) => {
              if (e.target.checked) onChange([...kinds.filter((x) => x !== k), k]);
              else onChange(kinds.length ? kinds.filter((x) => x !== k) : ALL.filter((x) => x !== k));
            }}
          />
          {k}
        </label>
      ))}
    </div>
  );
}
```

```tsx
// app/src/renderer/main/components/ActivityRow.tsx
import { useState } from 'react';
import { ScreenshotPreview } from './ScreenshotPreview.js';

type Row = { id: number; ts: string; kind: string; payload: Record<string, unknown> };

export function ActivityRow({ row, onDelete }: { row: Row; onDelete: () => void }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={`activity-row activity-${row.kind}`}>
      <time>{new Date(row.ts).toLocaleString()}</time>
      <span className="kind">{row.kind}</span>
      <span className="summary">{summarize(row)}</span>
      {row.kind === 'screenshot_captured' && (
        <button onClick={() => setExpanded((v) => !v)}>{expanded ? 'Hide' : 'Show'}</button>
      )}
      <button className="delete" onClick={onDelete} aria-label="Delete">×</button>
      {expanded && row.kind === 'screenshot_captured' && <ScreenshotPreview id={row.id} />}
    </li>
  );
}

function summarize(row: Row): string {
  const p = row.payload as Record<string, unknown>;
  switch (row.kind) {
    case 'window_focus':       return `${String(p.app ?? '')} — ${String(p.title ?? '')}`;
    case 'gdocs_revision':     return `Edited "${String(p.name ?? '')}"`;
    case 'file_modified':      return `Modified ${String(p.path ?? '')}`;
    case 'file_added':         return `Added ${String(p.path ?? '')}`;
    case 'git_commit':         return `Commit ${String(p.hash ?? '').slice(0, 7)}: ${String(p.message ?? '').split('\n')[0]}`;
    case 'screenshot_captured':return `Screenshot ${String(p.width ?? '?')}×${String(p.height ?? '?')}`;
    case 'screenshot_inferred':return `Inferred: ${String(p.summary ?? '')}`;
    default:                   return JSON.stringify(p);
  }
}
```

```tsx
// app/src/renderer/main/components/ScreenshotPreview.tsx
import { useEffect, useState } from 'react';

export function ScreenshotPreview({ id }: { id: number }): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    void (async (): Promise<void> => {
      const result = await window.plover.getScreenshot(id);
      setDataUrl(result?.dataUrl ?? null);
    })();
  }, [id]);
  if (!dataUrl) return <p className="screenshot-missing">Image unavailable.</p>;
  return <img src={dataUrl} alt={`Screenshot #${id}`} className="screenshot-preview" />;
}
```

- [ ] **Step 3: Add nav + route in `App.tsx`**

Add an `Activity` entry to the existing main-window nav and route. Mirror the pattern already used for `TasksToday` / `GoalsList` / `Settings`. (Match the existing routing approach — if it uses a switch on a `view` state, add a `'activity'` case.)

- [ ] **Step 4: Smoke test**

```tsx
// app/tests/renderer/Activity.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Activity } from '../../src/renderer/main/pages/Activity.js';

beforeEach(() => {
  (window as unknown as { plover: unknown }).plover = {
    listActivity: vi.fn().mockResolvedValue([
      { id: 1, ts: '2026-06-25T12:00:00.000Z', kind: 'window_focus', payload: { app: 'Slack', title: '#eng' } },
    ]),
    purgeActivity: vi.fn().mockResolvedValue({ deleted: 1 }),
    getScreenshot: vi.fn(),
    getActivityById: vi.fn(),
  };
});

describe('Activity page', () => {
  it('renders rows from listActivity', async () => {
    render(<Activity />);
    expect(await screen.findByText(/Slack/)).toBeInTheDocument();
  });

  it('removes a row when × is clicked', async () => {
    render(<Activity />);
    const del = await screen.findByLabelText('Delete');
    fireEvent.click(del);
    expect(screen.queryByText(/Slack/)).toBeNull();
  });
});
```

- [ ] **Step 5: Run + commit**

```
pnpm --filter ./app run test
pnpm typecheck && pnpm lint
git add app/src/renderer/main/pages/Activity.tsx app/src/renderer/main/components/ActivityRow.tsx app/src/renderer/main/components/ScreenshotPreview.tsx app/src/renderer/main/App.tsx app/src/main/ipc.ts app/src/preload/index.ts app/tests/renderer/Activity.test.tsx
git commit -m "feat(renderer): activity timeline view with screenshot preview"
```

---

## Task 7: Settings panel — Activity tracking group

**Files:**
- Modify: `app/src/renderer/main/pages/Settings.tsx`

**Interfaces:**
- Consumes: `window.plover.getSettings()`, `window.plover.updateSettings({...})`, `window.plover.getScreenRecordingStatus()`, `window.plover.requestScreenRecording()`.

- [ ] **Step 1: Add the activity-tracking section**

Insert a new section below the existing Calendar / Working hours sections in `Settings.tsx`:

```tsx
// In Settings.tsx — pseudocode skeleton; match the file's existing component conventions
function ActivityTrackingSection({ settings, onChange }: { settings: any; onChange: (patch: any) => Promise<void> }): JSX.Element {
  const [permission, setPermission] = useState<string>('not-determined');
  useEffect(() => { void window.plover.getScreenRecordingStatus().then(setPermission); }, []);

  const toggleScreen = async (enabled: boolean): Promise<void> => {
    if (!enabled) { await onChange({ screenCaptureEnabled: false }); return; }
    const status = await window.plover.requestScreenRecording();
    setPermission(status);
    if (status !== 'granted') {
      alert('Screen Recording permission is required. Open System Settings → Privacy & Security → Screen Recording, add Plover, then try again.');
      return;
    }
    await onChange({ screenCaptureEnabled: true });
  };

  return (
    <section className="settings-section">
      <h2>Activity tracking</h2>
      <label><input type="checkbox" checked={settings.pauseAllTracking} onChange={(e) => onChange({ pauseAllTracking: e.target.checked })} /> Pause all tracking</label>
      <label><input type="checkbox" checked={settings.windowTrackingEnabled} onChange={(e) => onChange({ windowTrackingEnabled: e.target.checked })} /> Window tracking</label>
      <label><input type="checkbox" checked={settings.gdocsPollingEnabled} onChange={(e) => onChange({ gdocsPollingEnabled: e.target.checked })} /> Google Docs polling</label>
      <label><input type="checkbox" checked={settings.fileWatchingEnabled} onChange={(e) => onChange({ fileWatchingEnabled: e.target.checked })} /> Watched-folder file events</label>
      <label>
        <input type="checkbox" checked={settings.screenCaptureEnabled} onChange={(e) => void toggleScreen(e.target.checked)} />
        Capture periodic screenshots {permission !== 'granted' && settings.screenCaptureEnabled ? '(permission not granted)' : ''}
      </label>
      <label>
        Capture interval (minutes):
        <input type="number" min={1} max={60} value={settings.screenCaptureIntervalMinutes}
          onChange={(e) => onChange({ screenCaptureIntervalMinutes: Number(e.target.value) })}
          disabled={!settings.screenCaptureEnabled} />
      </label>
      <label>
        <input type="checkbox" checked={settings.screenVisionInferenceEnabled}
          onChange={(e) => onChange({ screenVisionInferenceEnabled: e.target.checked })}
          disabled={!settings.screenCaptureEnabled} />
        Send screenshots to Gemini Vision to infer activity
      </label>
      <label>
        Retention (days, 0 = keep forever):
        <input type="number" min={0} value={settings.activityRetentionDays}
          onChange={(e) => onChange({ activityRetentionDays: Number(e.target.value) })} />
      </label>
      <label><input type="checkbox" checked={settings.planner_useRecentActivityContext}
        onChange={(e) => onChange({ planner_useRecentActivityContext: e.target.checked })} />
        Include recent activity as context when decomposing goals
      </label>
      <button onClick={() => window.plover.purgeActivity({ olderThan: new Date(0).toISOString() }).then(() => alert('All activity deleted'))}>
        Delete all activity
      </button>
    </section>
  );
}
```

Wire this section into the existing Settings component the same way other sections are wired (load `settings` from `getSettings`, debounce / immediately persist via `updateSettings`).

- [ ] **Step 2: Side-effect — toggling `screenCaptureEnabled` on/off must start/stop the capturer at runtime**

In `app/src/main/ipc.ts`, after handling a `settings:update` that touches `screenCaptureEnabled`, call into the activity init module:

```ts
import { getScreenCapturer } from './activity/index.js';

ipcMain.handle('settings:update', async (_, patch: Partial<SettingsData>) => {
  settingsRepo.update(patch);
  if (patch.screenCaptureEnabled !== undefined) {
    const cap = getScreenCapturer();
    if (cap) {
      if (patch.screenCaptureEnabled) cap.start();
      else cap.stop();
    }
  }
  return settingsRepo.getAll();
});
```

(Adapt to whatever the current `settings:update` handler signature is — keep the existing behavior, just add the start/stop branch.)

- [ ] **Step 3: Verify + commit**

```
pnpm typecheck && pnpm lint && pnpm test
git add app/src/renderer/main/pages/Settings.tsx app/src/main/ipc.ts
git commit -m "feat(settings-ui): activity tracking group with screenshot consent flow"
```

---

## Task 8: Backend — `/api/infer-screen` (Gemini Vision)

**Files:**
- Modify: `server/src/index.ts`
- Test: `server/test/infer-screen.test.ts`

**Interfaces:**
- Consumes: `POST /api/infer-screen` with `{ screenshotBase64, windowContext?, authToken? }`.
- Produces: `{ summary, activeApp, currentTask, confidence }`.

- [ ] **Step 1: Write failing test**

```ts
// server/test/infer-screen.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const generateContent = vi.fn();
const getGenerativeModel = vi.fn().mockReturnValue({ generateContent });

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({ getGenerativeModel })),
  FunctionCallingMode: { ANY: 'ANY' },
  SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' },
}));

process.env.GEMINI_API_KEY = 'test-key';
const { default: app } = await import('../src/app.js'); // require us to split the express app out

describe('POST /api/infer-screen', () => {
  beforeEach(() => { generateContent.mockReset(); getGenerativeModel.mockReturnValue({ generateContent }); });

  it('rejects missing screenshot', async () => {
    const res = await request(app).post('/api/infer-screen').send({});
    expect(res.status).toBe(400);
  });

  it('returns structured Vision output on success', async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        functionCalls: () => [{ name: 'inferScreen', args: { summary: 'User is in Slack', activeApp: 'Slack', currentTask: 'Replying to a thread', confidence: 0.7 } }],
      },
    });
    const res = await request(app).post('/api/infer-screen').send({
      screenshotBase64: Buffer.from([0x89, 0x50]).toString('base64'),
      windowContext: { app: 'Slack', title: '#eng' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ summary: 'User is in Slack', activeApp: 'Slack', confidence: 0.7 });
  });
});
```

- [ ] **Step 2: Split the express app so it can be imported in tests**

If `server/src/index.ts` calls `app.listen()` at top level, extract the `app` definition into `server/src/app.ts` (exporting `app`) and leave `index.ts` as a thin entry that imports and calls `listen`. This is necessary for supertest. Keep `process.loadEnvFile()` in `index.ts`.

```ts
// server/src/index.ts (after refactor)
try { process.loadEnvFile(); } catch { /* env may be set externally */ }
import app from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Plover backend proxy on port ${PORT}`));
```

- [ ] **Step 3: Implement the endpoint inside `server/src/app.ts`**

```ts
// server/src/app.ts — add near the other endpoints

const inferScreenDeclaration: FunctionDeclaration = {
  name: 'inferScreen',
  description: 'Describe what the user is doing in the screenshot.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      summary: { type: SchemaType.STRING, description: '1–2 sentence description of the screen; never include emails, full names beyond first-name greetings, monetary amounts, or chat content.' },
      activeApp: { type: SchemaType.STRING, description: 'Best guess at the focused app.' },
      currentTask: { type: SchemaType.STRING, description: 'Inferred task or null.' },
      confidence: { type: SchemaType.NUMBER, description: '0..1 confidence in the inference.' },
    },
    required: ['summary', 'activeApp', 'confidence'],
  },
};

app.post('/api/infer-screen', async (req, res): Promise<any> => {
  const authToken = process.env.AUTH_TOKEN;
  if (authToken && req.headers['x-plover-auth-token'] !== authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { screenshotBase64, windowContext } = req.body ?? {};
  if (typeof screenshotBase64 !== 'string' || !screenshotBase64) {
    return res.status(400).json({ error: 'Missing screenshotBase64' });
  }
  const approxBytes = Math.floor((screenshotBase64.length * 3) / 4);
  if (approxBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Screenshot too large (>5MB)' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const defaultModel = (process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash').trim();
    const candidates = [defaultModel, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].filter((m, i, a) => a.indexOf(m) === i);

    const contextLine = windowContext ? `Active window context: app="${windowContext.app}", title="${windowContext.title}"${windowContext.browserUrl ? `, url="${windowContext.browserUrl}"` : ''}` : 'No window context available.';
    const prompt = `Describe what the user is doing in this screenshot. ${contextLine}\n\nNever include emails, full names beyond first-name greetings, monetary amounts, or chat content in your summary. Call the "inferScreen" tool with the result.`;

    let response: any;
    let lastError: Error | null = null;
    for (const modelName of candidates) {
      try {
        const model = client.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.1 } });
        response = await model.generateContent({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
            { text: prompt },
          ] }],
          tools: [{ functionDeclarations: [inferScreenDeclaration] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY, allowedFunctionNames: ['inferScreen'] } },
        });
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    if (!response) return res.status(502).json({ error: `All Gemini models failed. Last: ${lastError?.message}` });

    const calls = typeof response.response.functionCalls === 'function' ? response.response.functionCalls() : undefined;
    const call: FunctionCall | undefined = calls?.[0] ?? response.response.candidates?.[0]?.content?.parts?.find((p: Part) => !!p.functionCall)?.functionCall;
    if (!call || call.name !== 'inferScreen') return res.status(502).json({ error: 'Gemini did not call inferScreen' });
    const args = call.args as { summary?: string; activeApp?: string; currentTask?: string; confidence?: number };
    return res.json({
      summary: String(args.summary ?? '').slice(0, 500),
      activeApp: String(args.activeApp ?? ''),
      currentTask: args.currentTask ? String(args.currentTask) : null,
      confidence: Math.max(0, Math.min(1, Number(args.confidence ?? 0))),
    });
  } catch (err: any) {
    console.error('[Server] /api/infer-screen:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});
```

Add `supertest` and `vitest` to `server/package.json` devDependencies if not present.

- [ ] **Step 4: Run + commit**

```
pnpm --filter ./server build
pnpm --filter ./server test 2>/dev/null || pnpm --filter ./server run test || echo "configure vitest in server/ if missing"
pnpm typecheck && pnpm lint && pnpm test
git add server/src/app.ts server/src/index.ts server/test/infer-screen.test.ts server/package.json
git commit -m "feat(server): /api/infer-screen Gemini Vision proxy with fallback models"
```

If the server has no test runner yet, add minimal vitest config (`server/vitest.config.ts`) and a `"test": "vitest run"` script as part of this task.

---

## Task 9: Wire renderer / main to call `/api/infer-screen`

**Files:**
- Modify: `app/src/main/activity/screen-capturer.ts` — after a successful capture, post to backend when `screenVisionInferenceEnabled` is true; log `screenshot_inferred`.
- Test: extend `app/tests/activity/screen-capturer.test.ts`

**Interfaces:**
- Consumes: `PLOVER_BACKEND_URL`, `PLOVER_AUTH_TOKEN` env vars (same pattern as `decompose.ts`).
- Produces: `screenshot_inferred` activity rows with payload `{ screenshotId, summary, activeApp, currentTask, confidence }`.

- [ ] **Step 1: Write failing test extension**

```ts
// app/tests/activity/screen-capturer.test.ts (append)
it('calls infer-screen and logs screenshot_inferred when vision is enabled', async () => {
  settingsRepo.update({ screenCaptureEnabled: true, screenVisionInferenceEnabled: true });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  getSources.mockResolvedValueOnce([{ name: 'Entire Screen', thumbnail: { toPNG: () => png, getSize: () => ({ width: 100, height: 100 }) } }]);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ summary: 'In Slack', activeApp: 'Slack', currentTask: null, confidence: 0.6 }),
  });
  vi.stubGlobal('fetch', fetchMock);
  await capturer.captureOnce();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const kinds = activityRepo.list().map((r) => r.kind);
  expect(kinds).toContain('screenshot_inferred');
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Extend `ScreenCapturer.captureOnce` to call backend**

Replace the trailing `this.deps.activityRepo.log('screenshot_captured', ...); return filePath;` with:

```ts
const captureRow = this.deps.activityRepo.insert({
  kind: 'screenshot_captured',
  payload: { filePath, width: size.width, height: size.height },
  ts: now.toISOString(),
});
if (settings.screenVisionInferenceEnabled) {
  void this.runInference(captureRow.id, filePath, png).catch((err) => console.error('[ScreenCapturer] infer failed:', err));
}
return filePath;
```

Add the helper method:

```ts
private async runInference(screenshotId: number, filePath: string, png: Buffer): Promise<void> {
  const backendUrl = (process.env.PLOVER_BACKEND_URL || 'http://localhost:3000').trim();
  const authToken = process.env.PLOVER_AUTH_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['X-Plover-Auth-Token'] = authToken;
  const res = await fetch(`${backendUrl}/api/infer-screen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ screenshotBase64: png.toString('base64') }),
  });
  if (!res.ok) return;
  const body = await res.json() as { summary?: string; activeApp?: string; currentTask?: string | null; confidence?: number };
  this.deps.activityRepo.log('screenshot_inferred', {
    screenshotId,
    filePath,
    summary: body.summary ?? '',
    activeApp: body.activeApp ?? '',
    currentTask: body.currentTask ?? null,
    confidence: Number(body.confidence ?? 0),
  });
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter ./app run test -- screen-capturer
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/activity/screen-capturer.ts app/tests/activity/screen-capturer.test.ts
git commit -m "feat(activity): post screenshots to /api/infer-screen and log screenshot_inferred"
```

---

## Task 10: Planner activity context

**Files:**
- Modify: `app/src/main/planner/decompose.ts` — accept `recentActivity` arg, forward to backend.
- Modify: `app/src/main/ipc.ts` — `goals:decompose` / `goal:propose` handlers gather recent activity from `ActivityRepo` when `planner_useRecentActivityContext` is on, before calling `decomposeGoal`.
- Modify: `server/src/app.ts` — accept `recentActivity` and inject into the prompt.
- Test: `app/tests/planner/decompose.test.ts`, `server/test/decompose-context.test.ts`

**Interfaces:**
- Consumes: `ActivityRepo.list({ since, limit })` from Task 2.
- Produces: extended `decomposeGoal` signature `{ goalText, now, workingHours, recentActivity? }`. Backend `/api/decompose` accepts and uses `recentActivity` (≤ 200 entries) when present.

- [ ] **Step 1: Write failing renderer-side test**

```ts
// app/tests/planner/decompose.test.ts (add or extend)
import { describe, it, expect, vi } from 'vitest';
import { decomposeGoal } from '../../src/main/planner/decompose.js';

describe('decomposeGoal recentActivity', () => {
  it('forwards recentActivity to the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ goal: { title: 'Finish doc' }, subtasks: [{ title: 'Outline', estimate_minutes: 30 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await decomposeGoal({
      goalText: 'Finish doc',
      now: new Date('2026-06-25T12:00:00.000Z'),
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: [{ kind: 'gdocs_revision', payload: { name: 'Q3 Roadmap' }, ts: '2026-06-25T11:00:00.000Z' }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? '{}');
    expect(body.recentActivity).toHaveLength(1);
    expect(body.recentActivity[0].kind).toBe('gdocs_revision');
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Extend `decomposeGoal`**

```ts
// app/src/main/planner/decompose.ts — extend signature + body
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string };
  recentActivity?: Array<{ kind: string; payload: Record<string, unknown>; ts: string }>;
}): Promise<...> {
  // ... existing setup
  const body: Record<string, unknown> = {
    goalText: input.goalText,
    now: input.now.toISOString(),
    workingHours: input.workingHours,
  };
  if (input.recentActivity && input.recentActivity.length > 0) {
    body.recentActivity = input.recentActivity.slice(0, 200);
  }
  const response = await fetch(`${backendUrl}/api/decompose`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  // rest unchanged
}
```

- [ ] **Step 3: Gather activity in IPC**

Find the `goals:decompose` (and/or `goal:propose`) IPC handler. Before calling `decomposeGoal(...)`:

```ts
const settings = settingsRepo.getAll();
let recentActivity: { kind: string; payload: Record<string, unknown>; ts: string }[] | undefined;
if (settings.planner_useRecentActivityContext) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  recentActivity = activityRepo
    .list({ since, limit: 50 })
    .map((r) => ({ kind: r.kind, payload: r.payload, ts: r.ts }));
}
const result = await decomposeGoal({
  goalText,
  now: new Date(),
  workingHours: settings.workingHours,
  ...(recentActivity ? { recentActivity } : {}),
});
```

- [ ] **Step 4: Extend backend `/api/decompose`**

```ts
// server/src/app.ts — /api/decompose handler
const { goalText, now, workingHours, recentActivity } = req.body;
// validate
if (recentActivity !== undefined) {
  if (!Array.isArray(recentActivity)) return res.status(400).json({ error: 'recentActivity must be an array' });
  if (recentActivity.length > 200) return res.status(400).json({ error: 'recentActivity exceeds 200 entries' });
}

// inside prompt construction, append when recentActivity is present:
const activityBlock = (recentActivity && recentActivity.length > 0)
  ? `\n\nThe user has had the following recent computer activity (chronological):\n${recentActivity.map((a: any) => `- [${a.ts}] ${a.kind}: ${JSON.stringify(a.payload)}`).join('\n')}\n\nUse this only as soft context — do NOT mention it back to the user, and do NOT force tasks to align with it. If the activity is irrelevant to the goal, ignore it.`
  : '';
const prompt = baseDecomposePrompt + activityBlock;
```

(`baseDecomposePrompt` = the existing prompt body, lifted into a local variable for clarity.)

- [ ] **Step 5: Backend test**

```ts
// server/test/decompose-context.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const generateContent = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({ getGenerativeModel: () => ({ generateContent }) })),
  FunctionCallingMode: { ANY: 'ANY' },
  SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' },
}));

process.env.GEMINI_API_KEY = 'test-key';
const { default: app } = await import('../src/app.js');

describe('/api/decompose with recentActivity', () => {
  beforeEach(() => generateContent.mockReset());

  it('rejects more than 200 activity entries', async () => {
    const res = await request(app).post('/api/decompose').send({
      goalText: 'x', now: '2026-06-25T00:00:00.000Z', workingHours: { start: '09:00', end: '18:00' },
      recentActivity: Array.from({ length: 201 }, (_, i) => ({ kind: 'k', payload: {}, ts: '2026-06-25T00:00:00.000Z' })),
    });
    expect(res.status).toBe(400);
  });

  it('includes the activity block in the prompt when provided', async () => {
    let capturedPrompt = '';
    generateContent.mockImplementationOnce(async (req: any) => {
      capturedPrompt = req.contents[0].parts[0].text;
      return { response: { functionCalls: () => [{ name: 'decomposeGoal', args: { goal: { title: 't', description: 'd' }, subtasks: [{ title: 's', estimate_minutes: 30 }] } }] } };
    });
    await request(app).post('/api/decompose').send({
      goalText: 'Finish doc',
      now: '2026-06-25T00:00:00.000Z',
      workingHours: { start: '09:00', end: '18:00' },
      recentActivity: [{ kind: 'gdocs_revision', payload: { name: 'Q3 Roadmap' }, ts: '2026-06-25T11:00:00.000Z' }],
    });
    expect(capturedPrompt).toMatch(/gdocs_revision/);
    expect(capturedPrompt).toMatch(/recent computer activity/);
  });
});
```

- [ ] **Step 6: Run + commit**

```
pnpm --filter ./app run test -- decompose
pnpm --filter ./server run test || echo "skip if server vitest config missing"
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/planner/decompose.ts app/src/main/ipc.ts app/tests/planner/decompose.test.ts server/src/app.ts server/test/decompose-context.test.ts
git commit -m "feat(planner): inject recent activity into decompose prompt (opt-in)"
```

---

## Task 11: Honor `gdocsPollingEnabled` and `fileWatchingEnabled` toggles

**Files:**
- Modify: `app/src/main/activity/gdocs-poller.ts` — return early when `pauseAllTracking || !gdocsPollingEnabled`.
- Modify: `app/src/main/activity/folder-watcher.ts` — return early on watch events when `pauseAllTracking || !fileWatchingEnabled`. Do NOT tear down the watcher on toggle-off; just suppress event logging so events can resume on toggle-on without re-walking the FS.
- Test: extend the existing test files for each (or create smoke tests if absent).

**Interfaces:**
- Consumes: settings keys from Task 1.

- [ ] **Step 1: Write failing tests**

For `gdocs-poller`, add a test that constructs the poller with `gdocsPollingEnabled = false` and asserts no Drive calls are made on tick. Pattern:

```ts
// app/tests/activity/gdocs-poller.test.ts (add)
it('skips polling when gdocsPollingEnabled is false', async () => {
  settingsRepo.update({ gdocsPollingEnabled: false });
  const driveSpy = vi.fn();
  // ... construct poller with a googleAuth whose drive client is the spy ...
  await poller.tick();
  expect(driveSpy).not.toHaveBeenCalled();
});

it('skips polling when pauseAllTracking is true', async () => {
  settingsRepo.update({ pauseAllTracking: true });
  // assert same as above
});
```

For `folder-watcher`, add a test that the `file_added` / `file_modified` event handler does not call `activityRepo.log` when `fileWatchingEnabled` is false.

- [ ] **Step 2: Implement the gates**

In `gdocs-poller.ts`, at the top of `tick()` (or whatever the loop function is called):

```ts
const settings = this.settingsRepo.getAll();
if (settings.pauseAllTracking || !settings.gdocsPollingEnabled) return;
```

In `folder-watcher.ts`, wrap each event-handler call site that writes to `activityRepo` with:

```ts
const settings = this.settingsRepo.getAll();
if (settings.pauseAllTracking || !settings.fileWatchingEnabled) return;
```

(Both files already accept a `SettingsRepo` instance through their constructor — confirm by reading them; if not, add it as a constructor argument and update the wiring in `app/src/main/activity/index.ts`.)

- [ ] **Step 3: Verify + commit**

```
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/activity/gdocs-poller.ts app/src/main/activity/folder-watcher.ts app/src/main/activity/index.ts app/tests/activity/gdocs-poller.test.ts app/tests/activity/folder-watcher.test.ts
git commit -m "feat(activity): honor gdocsPollingEnabled and fileWatchingEnabled toggles"
```

---

## Task 12: Retention scheduler

**Files:**
- Modify: `app/src/main/activity/index.ts` — schedule retention every 6 hours; also run once at startup.

**Interfaces:**
- Consumes: `runRetention` from Task 2.

- [ ] **Step 1: Schedule retention in init**

```ts
// app/src/main/activity/index.ts (add)
import { runRetention } from './retention.js';

let retentionIntervalId: NodeJS.Timeout | null = null;

// inside initActivityMonitoring(), at the end:
void runRetention({ activityRepo, settingsRepo, now: new Date() })
  .catch((err) => console.error('[Activity] retention failed:', err));
if (!retentionIntervalId) {
  retentionIntervalId = setInterval(() => {
    void runRetention({ activityRepo, settingsRepo, now: new Date() })
      .catch((err) => console.error('[Activity] retention failed:', err));
  }, 6 * 60 * 60 * 1000);
}

// inside stopActivityMonitoring():
if (retentionIntervalId) { clearInterval(retentionIntervalId); retentionIntervalId = null; }
```

- [ ] **Step 2: Verify + commit**

```
pnpm typecheck && pnpm lint && pnpm test
git add app/src/main/activity/index.ts
git commit -m "feat(activity): run retention on startup and every 6 hours"
```

---

## Final verification

After Task 12, from the repo root:

```
pnpm typecheck && pnpm lint && pnpm test
```

All green. Then a manual smoke pass per the spec's acceptance criteria:

1. Fresh launch with default settings → no Screen Recording prompt, zero `screenshot_*` rows, `Activity` page shows existing `window_focus` events.
2. Toggle `Capture screenshots` on → OS prompts for Screen Recording. Grant → setting stays on. Deny → setting reverts to off with a Settings inline message.
3. With capture on, wait 15 minutes → exactly 3 PNG files under `<userData>/screenshots/2026/.../`, 3 `screenshot_captured` rows in `Activity`.
4. Toggle Vision inference on → next capture also produces a `screenshot_inferred` row whose summary appears in the timeline.
5. Set retention to 1 day → wait one retention tick (or restart) → rows older than 1 day are gone and their PNG files unlinked.
6. With `planner_useRecentActivityContext` on, decompose the goal *"Finish the design doc I've been working on"* with recent `gdocs_revision` events present → subtasks reference the existing document.

Report green to the user.

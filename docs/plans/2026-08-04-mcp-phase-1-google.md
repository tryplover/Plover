# MCP - Phase 1 (Google) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared connector infrastructure (`sync_cursors` + a reusable source-poller scaffold + an outbound allowlist gate) and the Google "connect everything" context sources — Gmail, Calendar, Classroom, and an extended Drive/Docs poller — so each feeds snapshot-diff activity into the agent's `activity` stream.

**Architecture:** New context sources live under the `Sync` module (the only module allowed to talk to external APIs) and follow the existing `sync/gdocs-poller.ts` shape. A generic `SourcePoller` scaffold owns the interval loop, gating, first-snapshot rule, and cursor read/write; each provider source implements a small `ContextSource` interface and emits a typed bus event. Subscribers under `activity/` write `activity` rows (new kinds + zod schemas), exactly like `gdocs-subscriber`. Cursors (never whole content) live in a new `sync_cursors` table.

**Tech Stack:** Electron main (TypeScript strict), `better-sqlite3`, `googleapis` + `google-auth-library`, `keytar`, `zod`, `vitest` + `nock`, pnpm workspace.

## Global Constraints

- TypeScript strict: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Do not loosen.
- No comments unless the WHY is non-obvious. No comment references to this task/plan.
- No real network in tests — mock `keytar`, mock `electron`, and mock `googleapis` (or `nock` for raw HTTP). See test patterns below.
- No new deps unless first imported in the task that adds them. (`googleapis`, `keytar`, `zod` already present.)
- User OAuth tokens live only in `keytar` (service `plover`), never in SQLite.
- Backend proxy stays Gemini-only: Google APIs are called directly with the user's OAuth client, not through `plover-server`.
- First connect of any source emits **no** historical backlog — record the current cursor and emit nothing.
- Verify with `pnpm typecheck && pnpm lint && pnpm test` from repo root (green) before claiming any task done. Colon scripts / filters per `plover-pnpm-workspace` (`pnpm --filter ./app ...`).
- Every commit message ends with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Naming reference (used across tasks — keep exact)

- Repo: `SyncCursorsRepo` — `app/src/main/store/repos/sync-cursors.ts`. Methods: `get(provider: string, source: string): string | null`, `set(provider: string, source: string, cursor: string): void`, `clear(provider: string): void`.
- Scaffold: `app/src/main/sync/source-poller.ts` — exports `interface ContextSource` and `class SourcePoller`.
- `ContextSource` shape:
  ```ts
  export interface ContextSource {
    provider: string;
    source: string;
    enabled(settings: SettingsData): boolean;
    // cursor is null on the first ever poll (first-snapshot). Return the next cursor
    // to persist. On first snapshot, seed + return the current cursor and emit nothing.
    poll(cursor: string | null): Promise<string>;
  }
  ```
- Google sources: `app/src/main/sync/google/gmail-source.ts` (`GmailSource`), `calendar-source.ts` (`CalendarSource`), `classroom-source.ts` (`ClassroomSource`).
- Subscribers: `app/src/main/activity/gmail-subscriber/gmail-subscriber.ts` (`GmailActivitySubscriber`), `calendar-subscriber/calendar-subscriber.ts` (`CalendarActivitySubscriber`), `classroom-subscriber/classroom-subscriber.ts` (`ClassroomActivitySubscriber`).
- New bus events + payloads (in `app/src/shared/events.ts`): `gmail.message` → `GmailMessagePayload`, `calendar.event` → `CalendarEventPayload`, `classroom.coursework` → `ClassroomCourseworkPayload`.
- New `activity.kind` values: `gmail_message`, `calendar_event`, `classroom_coursework`.
- New settings booleans (default **on** once Google is connected, i.e. read with `!== 'false'`): `gmailEnabled`, `calendarEnabled`, `classroomEnabled`.
- Cursor `source` values (provider is always `'google'`): `gmail`, `calendar`, `classroom`.

## Shared test harness (reuse verbatim at the top of every new `*.test.ts`)

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';

const { mockKeychain } = vi.hoisted(() => ({ mockKeychain: new Map<string, string>() }));

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async (s: string, a: string) => mockKeychain.get(`${s}:${a}`) ?? null),
    setPassword: vi.fn(async (s: string, a: string, v: string) => void mockKeychain.set(`${s}:${a}`, v)),
    deletePassword: vi.fn(async (s: string, a: string) => { mockKeychain.delete(`${s}:${a}`); return true; }),
  },
}));

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn().mockResolvedValue(true) },
  app: { isPackaged: false },
}));
```

For Google source tests, mock the SDK so no host guessing is needed:

```ts
// Declared per-test-file. Return stub resource clients whose methods are vi.fn().
const { gmailStub } = vi.hoisted(() => ({ gmailStub: { users: {
  getProfile: vi.fn(), history: { list: vi.fn() }, messages: { get: vi.fn() },
} } }));
vi.mock('googleapis', () => ({
  google: {
    // preserve auth constructor so `new GoogleAuth()` still works if imported
    auth: { OAuth2: class { setCredentials() {} generateAuthUrl() { return ''; } getToken() { return { tokens: {} }; } get credentials() { return {}; } } },
    gmail: vi.fn(() => gmailStub),
    calendar: vi.fn(() => ({ events: { list: vi.fn() } })),
    classroom: vi.fn(() => ({ courses: { list: vi.fn(), courseWork: { list: vi.fn() } } })),
    drive: vi.fn(),
  },
}));
```

Each source takes an injected auth-like object `{ client: OAuth2Client }`; tests pass `{ client: {} as never }` since the SDK is mocked.

---

## Task 1: `sync_cursors` table + `SyncCursorsRepo`

**Files:**
- Modify: `app/src/main/store/db.ts` (append migration version 7 to `MIGRATIONS`)
- Create: `app/src/main/store/repos/sync-cursors.ts`
- Create: `app/tests/store/sync-cursors-repo.test.ts`

**Interfaces:**
- Produces: `SyncCursorsRepo` with `get`, `set`, `clear` as in the naming reference.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SyncCursorsRepo } from '../../src/main/store/repos/sync-cursors';

describe('SyncCursorsRepo', () => {
  let db: Database.Database;
  let repo: SyncCursorsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new SyncCursorsRepo(db);
  });

  it('returns null for an unknown cursor', () => {
    expect(repo.get('google', 'gmail')).toBeNull();
  });

  it('upserts and reads a cursor', () => {
    repo.set('google', 'gmail', '12345');
    expect(repo.get('google', 'gmail')).toBe('12345');
    repo.set('google', 'gmail', '67890');
    expect(repo.get('google', 'gmail')).toBe('67890');
  });

  it('clears all cursors for a provider only', () => {
    repo.set('google', 'gmail', 'a');
    repo.set('google', 'calendar', 'b');
    repo.set('github', 'commits', 'c');
    repo.clear('google');
    expect(repo.get('google', 'gmail')).toBeNull();
    expect(repo.get('google', 'calendar')).toBeNull();
    expect(repo.get('github', 'commits')).toBe('c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/store/sync-cursors-repo.test.ts`
Expected: FAIL — `SyncCursorsRepo` not found / no such table `sync_cursors`.

- [ ] **Step 3: Add migration version 7 in `db.ts`**

Append to the `MIGRATIONS` array (after version 6):

```ts
  {
    version: 7,
    sql: `
      CREATE TABLE sync_cursors (
        provider TEXT NOT NULL,
        source TEXT NOT NULL,
        cursor TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider, source)
      );
    `,
  },
```

- [ ] **Step 4: Implement `SyncCursorsRepo`**

```ts
import Database from 'better-sqlite3';

export class SyncCursorsRepo {
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private clearStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.getStmt = db.prepare('SELECT cursor FROM sync_cursors WHERE provider = ? AND source = ?');
    this.setStmt = db.prepare(`
      INSERT INTO sync_cursors (provider, source, cursor, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(provider, source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at
    `);
    this.clearStmt = db.prepare('DELETE FROM sync_cursors WHERE provider = ?');
  }

  get(provider: string, source: string): string | null {
    const row = this.getStmt.get(provider, source) as { cursor: string } | undefined;
    return row ? row.cursor : null;
  }

  set(provider: string, source: string, cursor: string): void {
    this.setStmt.run(provider, source, cursor, new Date().toISOString());
  }

  clear(provider: string): void {
    this.clearStmt.run(provider);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter ./app exec vitest run tests/store/sync-cursors-repo.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/store/db.ts app/src/main/store/repos/sync-cursors.ts app/tests/store/sync-cursors-repo.test.ts
git commit -m "feat(store): add sync_cursors table + SyncCursorsRepo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `SourcePoller` scaffold + `ContextSource`

**Files:**
- Create: `app/src/main/sync/source-poller.ts`
- Create: `app/tests/sync/source-poller.test.ts`

**Interfaces:**
- Consumes: `SyncCursorsRepo` (Task 1), `SettingsRepo`, `SettingsData` (existing).
- Produces: `interface ContextSource` (naming reference) and `class SourcePoller`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { SyncCursorsRepo } from '../../src/main/store/repos/sync-cursors';
import { SourcePoller, ContextSource } from '../../src/main/sync/source-poller';

function makeSource(over: Partial<ContextSource> = {}): ContextSource {
  return {
    provider: 'google',
    source: 'gmail',
    enabled: () => true,
    poll: vi.fn(async () => 'next-cursor'),
    ...over,
  };
}

describe('SourcePoller', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepo;
  let cursors: SyncCursorsRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    settingsRepo = new SettingsRepo(db);
    cursors = new SyncCursorsRepo(db);
  });

  afterEach(() => vi.useRealTimers());

  it('skips when pauseAllTracking is set', async () => {
    settingsRepo.update({ pauseAllTracking: true });
    const source = makeSource();
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('skips when the source is disabled', async () => {
    const source = makeSource({ enabled: () => false });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('skips when preflight returns false', async () => {
    const source = makeSource();
    const poller = new SourcePoller(source, cursors, settingsRepo, 1000, async () => false);
    await poller.poll();
    expect(source.poll).not.toHaveBeenCalled();
  });

  it('passes null cursor on first poll and persists the returned cursor', async () => {
    const source = makeSource({ poll: vi.fn(async (c) => { expect(c).toBeNull(); return 'c1'; }) });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(cursors.get('google', 'gmail')).toBe('c1');
  });

  it('passes the stored cursor on the next poll', async () => {
    cursors.set('google', 'gmail', 'c1');
    const source = makeSource({ poll: vi.fn(async (c) => { expect(c).toBe('c1'); return 'c2'; }) });
    await new SourcePoller(source, cursors, settingsRepo, 1000).poll();
    expect(cursors.get('google', 'gmail')).toBe('c2');
  });

  it('does not throw when the source poll rejects', async () => {
    const source = makeSource({ poll: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(new SourcePoller(source, cursors, settingsRepo, 1000).poll()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/sync/source-poller.test.ts`
Expected: FAIL — module `source-poller` not found.

- [ ] **Step 3: Implement the scaffold**

```ts
import { SettingsRepo, SettingsData } from '../store/repos/settings.js';
import { SyncCursorsRepo } from '../store/repos/sync-cursors.js';

export interface ContextSource {
  provider: string;
  source: string;
  enabled(settings: SettingsData): boolean;
  poll(cursor: string | null): Promise<string>;
}

export class SourcePoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private source: ContextSource,
    private cursors: SyncCursorsRepo,
    private settingsRepo: SettingsRepo,
    private intervalMs: number,
    private preflight?: () => Promise<boolean>,
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.poll().catch((err) => console.error(`Error in SourcePoller(${this.source.source}) tick:`, err));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async poll(): Promise<void> {
    const settings = this.settingsRepo.getAll();
    if (settings.pauseAllTracking) return;
    if (!this.source.enabled(settings)) return;
    if (this.preflight && !(await this.preflight())) return;
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const cursor = this.cursors.get(this.source.provider, this.source.source);
      const next = await this.source.poll(cursor);
      if (next && next !== cursor) {
        this.cursors.set(this.source.provider, this.source.source, next);
      }
    } catch (error) {
      console.error(`Failed to poll ${this.source.provider}/${this.source.source}:`, error);
    } finally {
      this.isPolling = false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./app exec vitest run tests/sync/source-poller.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/sync/source-poller.ts app/tests/sync/source-poller.test.ts
git commit -m "feat(sync): add reusable SourcePoller scaffold + ContextSource

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Outbound-host allowlist gate

**Files:**
- Create: `app/src/main/http/allowlist.ts`
- Create: `app/tests/http/allowlist.test.ts`
- Modify: `CLAUDE.md` (Outbound HTTP allowlist bullet — add the new Google hosts)

**Interfaces:**
- Produces: `ALLOWED_HOSTS: readonly string[]` and `assertAllowedHost(urlOrHost: string): void` (throws `Error` for a disallowed host).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { assertAllowedHost, ALLOWED_HOSTS } from '../../src/main/http/allowlist';

describe('assertAllowedHost', () => {
  it('allows the enumerated Google hosts', () => {
    for (const host of ['gmail.googleapis.com', 'www.googleapis.com', 'calendar.googleapis.com', 'classroom.googleapis.com', 'generativelanguage.googleapis.com']) {
      expect(() => assertAllowedHost(`https://${host}/x`)).not.toThrow();
    }
  });

  it('throws for a host not on the list', () => {
    expect(() => assertAllowedHost('https://evil.example.com/x')).toThrow(/not allowed/i);
  });

  it('exposes the list as a frozen array', () => {
    expect(Object.isFrozen(ALLOWED_HOSTS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./app exec vitest run tests/http/allowlist.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement the allowlist**

```ts
export const ALLOWED_HOSTS = Object.freeze([
  'generativelanguage.googleapis.com',
  'www.googleapis.com',
  'gmail.googleapis.com',
  'calendar.googleapis.com',
  'classroom.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
]);

export function assertAllowedHost(urlOrHost: string): void {
  let host = urlOrHost;
  try {
    host = new URL(urlOrHost).host;
  } catch {
    // already a bare host
  }
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new Error(`Outbound host not allowed: ${host}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes** → PASS.

- [ ] **Step 5: Update `CLAUDE.md`**

Replace the Outbound HTTP allowlist bullet's host list with the enumerated hosts above and note it is now enforced by `app/src/main/http/allowlist.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/http/allowlist.ts app/tests/http/allowlist.test.ts CLAUDE.md
git commit -m "feat(http): enforce outbound-host allowlist; add Google hosts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Expand Google scopes + reset cursors on (dis)connect

**Files:**
- Modify: `app/src/main/sync/google-auth.ts:18` (`GOOGLE_API_SCOPES`)
- Modify: `app/src/main/ipc/auth.ts` (`google:connect` / `google:disconnect` handlers)
- Modify: `app/tests/sync/google-auth.test.ts` (or create if absent) — assert the scope set

**Interfaces:**
- Consumes: `SyncCursorsRepo` (Task 1), `syncCursors` singleton from `app/src/main/store/index.ts` (add it there if not exported — mirror `settingsRepo` export).
- Produces: expanded `GOOGLE_API_SCOPES`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { GOOGLE_API_SCOPES } from '../../src/main/sync/google-auth';

describe('GOOGLE_API_SCOPES', () => {
  it('requests all Phase-1 surfaces in one consent', () => {
    expect(GOOGLE_API_SCOPES).toEqual(expect.arrayContaining([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    ]));
  });
});
```

(Keep the `keytar`/`electron` mocks from the shared harness at the top of the file.)

- [ ] **Step 2: Run test to verify it fails** → FAIL (missing scopes).

- [ ] **Step 3: Expand the scopes**

Replace `GOOGLE_API_SCOPES` in `google-auth.ts:18`:

```ts
export const GOOGLE_API_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];
```

- [ ] **Step 4: Reset cursors on connect/disconnect**

In `app/src/main/ipc/auth.ts`, import the `syncCursors` singleton (add `export const syncCursors = new SyncCursorsRepo(db);` to `app/src/main/store/index.ts` next to `settingsRepo`). In the `google:connect` success branch and the `google:disconnect` handler, add:

```ts
syncCursors.clear('google');
```

so a fresh connect re-snapshots (emits no backlog) and a disconnect discards stale watermarks.

- [ ] **Step 5: Run tests** — `pnpm --filter ./app exec vitest run tests/sync/google-auth.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/sync/google-auth.ts app/src/main/ipc/auth.ts app/src/main/store/index.ts app/tests/sync/google-auth.test.ts
git commit -m "feat(sync): request full Google scope set; reset cursors on (dis)connect

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Gmail source + event + activity kind + subscriber (reference connector)

**Files:**
- Modify: `app/src/shared/events.ts` (add `GmailMessagePayload` + `'gmail.message'`)
- Modify: `app/src/main/store/repos/activity-types.ts` (add `GmailMessageSchema`, type, union member)
- Modify: `app/src/main/store/repos/activity.ts` (add `gmail_message` case)
- Create: `app/src/main/sync/google/gmail-source.ts`
- Create: `app/src/main/activity/gmail-subscriber/gmail-subscriber.ts`
- Create: `app/tests/sync/gmail-source.test.ts`
- Create: `app/tests/activity/gmail-subscriber.test.ts`

**Interfaces:**
- Consumes: `ContextSource` (Task 2), `TypedEventBus`, `SettingsData`, `ActivityRepo`, `SettingsRepo`, `gate`.
- Produces: `GmailSource` (implements `ContextSource`), `GmailActivitySubscriber`, `GmailMessagePayload`, `gmail_message` kind.

- [ ] **Step 1: Add the payload + event type**

In `app/src/shared/events.ts` add:

```ts
export interface GmailMessagePayload {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  labels: string[];
  receivedAt: string;
}
```

and in `EventPayloads`: `'gmail.message': GmailMessagePayload;`

- [ ] **Step 2: Add the zod schema + activity union member**

In `activity-types.ts`:

```ts
export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  labels: z.array(z.string()),
  receivedAt: z.string(),
});
export type GmailMessagePayload = z.infer<typeof GmailMessageSchema>;
```

Add to the `ActivityRow` union (before the open `{ kind: string; ... }` fallback):

```ts
  | { id: number; ts: string; kind: 'gmail_message'; payload: GmailMessagePayload }
```

In `activity.ts` import `GmailMessageSchema` and add a case in `parseRow`'s switch:

```ts
      case 'gmail_message': {
        const result = GmailMessageSchema.safeParse(payload);
        if (result.success) {
          return { id: row.id, ts: row.ts, kind: 'gmail_message', payload: result.data };
        }
        break;
      }
```

- [ ] **Step 3: Write the failing Gmail source test**

```ts
// shared harness (keytar/electron/googleapis mocks with gmailStub) at top — see plan header
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GmailSource } from '../../src/main/sync/google/gmail-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { GmailMessagePayload } from '../../src/shared/events';

describe('GmailSource', () => {
  let bus: TypedEventBus;
  let source: GmailSource;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new TypedEventBus();
    source = new GmailSource({ client: {} as never }, bus);
  });

  it('first snapshot records current historyId and emits nothing', async () => {
    gmailStub.users.getProfile.mockResolvedValue({ data: { historyId: '1000' } });
    const events: GmailMessagePayload[] = [];
    bus.on('gmail.message', (p) => events.push(p));

    const next = await source.poll(null);

    expect(next).toBe('1000');
    expect(events).toHaveLength(0);
    expect(gmailStub.users.history.list).not.toHaveBeenCalled();
  });

  it('emits one event per added message since the cursor and returns the new historyId', async () => {
    gmailStub.users.history.list.mockResolvedValue({ data: {
      historyId: '1010',
      history: [{ messagesAdded: [{ message: { id: 'm1', threadId: 't1' } }] }],
    } });
    gmailStub.users.messages.get.mockResolvedValue({ data: {
      id: 'm1', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], internalDate: '1700000000000',
      payload: { headers: [{ name: 'From', value: 'a@b.com' }, { name: 'Subject', value: 'Hi' }] },
      snippet: 'hello there',
    } });
    const events: GmailMessagePayload[] = [];
    bus.on('gmail.message', (p) => events.push(p));

    const next = await source.poll('1000');

    expect(gmailStub.users.history.list).toHaveBeenCalledWith(expect.objectContaining({ startHistoryId: '1000' }));
    expect(next).toBe('1010');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: 'm1', threadId: 't1', from: 'a@b.com', subject: 'Hi', snippet: 'hello there',
      labels: ['INBOX', 'UNREAD'], receivedAt: new Date(1700000000000).toISOString(),
    });
  });

  it('keeps the old cursor when there is no history', async () => {
    gmailStub.users.history.list.mockResolvedValue({ data: {} });
    const next = await source.poll('1000');
    expect(next).toBe('1000');
  });
});
```

- [ ] **Step 4: Run test to verify it fails** → FAIL (`GmailSource` missing).

- [ ] **Step 5: Implement `GmailSource`**

```ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '../../events/bus.js';
import { SettingsData } from '../../store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => (x.name ?? '').toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

export class GmailSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'gmail';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.gmailEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const gmail = google.gmail({ version: 'v1', auth: this.auth.client });

    if (cursor === null) {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return String(profile.data.historyId ?? '');
    }

    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: cursor,
      historyTypes: ['messageAdded'],
    });

    const history = res.data.history ?? [];
    for (const h of history) {
      for (const added of h.messagesAdded ?? []) {
        const id = added.message?.id;
        if (!id) continue;
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject'] });
        const d = msg.data;
        this.eventBus.emit('gmail.message', {
          id: d.id ?? id,
          threadId: d.threadId ?? '',
          from: header(d.payload?.headers ?? undefined, 'From'),
          subject: header(d.payload?.headers ?? undefined, 'Subject'),
          snippet: d.snippet ?? '',
          labels: d.labelIds ?? [],
          receivedAt: d.internalDate ? new Date(Number(d.internalDate)).toISOString() : new Date().toISOString(),
        });
      }
    }

    return res.data.historyId ? String(res.data.historyId) : cursor;
  }
}
```

- [ ] **Step 6: Run test to verify it passes** → PASS.

- [ ] **Step 7: Write the failing subscriber test**

```ts
// keytar/electron mocks at top
import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/store/db';
import { ActivityRepo } from '../../src/main/store/repos/activity';
import { SettingsRepo } from '../../src/main/store/repos/settings';
import { TypedEventBus } from '../../src/main/events/bus';
import { GmailActivitySubscriber } from '../../src/main/activity/gmail-subscriber/gmail-subscriber';

describe('GmailActivitySubscriber', () => {
  let db: Database.Database, activity: ActivityRepo, settings: SettingsRepo, bus: TypedEventBus;
  beforeEach(() => {
    db = new Database(':memory:'); runMigrations(db);
    activity = new ActivityRepo(db); settings = new SettingsRepo(db); bus = new TypedEventBus();
  });

  it('writes a gmail_message activity row on gmail.message when enabled', () => {
    settings.update({ gmailEnabled: true, pauseAllTracking: false });
    new GmailActivitySubscriber(activity, settings, bus).start();
    bus.emit('gmail.message', { id: 'm1', threadId: 't1', from: 'a@b.com', subject: 'Hi', snippet: 's', labels: ['INBOX'], receivedAt: '2026-08-04T00:00:00.000Z' });
    const rows = activity.list({ kind: 'gmail_message' });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ id: 'm1', subject: 'Hi' });
  });

  it('does not write when pauseAllTracking is set', () => {
    settings.update({ gmailEnabled: true, pauseAllTracking: true });
    new GmailActivitySubscriber(activity, settings, bus).start();
    bus.emit('gmail.message', { id: 'm1', threadId: 't1', from: 'a@b.com', subject: 'Hi', snippet: 's', labels: [], receivedAt: '2026-08-04T00:00:00.000Z' });
    expect(activity.list({ kind: 'gmail_message' })).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Implement `GmailActivitySubscriber`** (mirrors `gdocs-subscriber.ts`)

```ts
import { ActivityRepo } from '../../store/repos/activity.js';
import { SettingsRepo } from '../../store/repos/settings.js';
import { TypedEventBus } from '../../events/bus.js';
import { GmailMessagePayload } from '../../../shared/events.js';
import { gate } from '../shared/gate.js';

export class GmailActivitySubscriber {
  constructor(
    private activityRepo: ActivityRepo,
    private settingsRepo: SettingsRepo,
    private eventBus: TypedEventBus,
  ) {}

  start(): void { this.eventBus.on('gmail.message', this.handle); }
  stop(): void { this.eventBus.off('gmail.message', this.handle); }

  private handle = (payload: GmailMessagePayload): void => {
    if (!gate(this.settingsRepo, 'gmailEnabled')) return;
    this.activityRepo.log('gmail_message', { ...payload });
  };
}
```

- [ ] **Step 9: Run both test files** → PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/shared/events.ts app/src/main/store/repos/activity-types.ts app/src/main/store/repos/activity.ts app/src/main/sync/google/gmail-source.ts app/src/main/activity/gmail-subscriber/ app/tests/sync/gmail-source.test.ts app/tests/activity/gmail-subscriber.test.ts
git commit -m "feat(sync): Gmail context source + gmail_message activity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Calendar source + event + activity kind + subscriber

**Files:** analogous to Task 5, for Calendar.
- Modify: `app/src/shared/events.ts`, `activity-types.ts`, `activity.ts`
- Create: `app/src/main/sync/google/calendar-source.ts`, `app/src/main/activity/calendar-subscriber/calendar-subscriber.ts`
- Create: `app/tests/sync/calendar-source.test.ts`, `app/tests/activity/calendar-subscriber.test.ts`

**Interfaces:** Produces `CalendarSource`, `CalendarActivitySubscriber`, `CalendarEventPayload`, `calendar_event` kind. Uses Calendar `syncToken` (incremental) with a `410 GONE` reseed.

- [ ] **Step 1: Payload + event** — in `events.ts`:

```ts
export interface CalendarEventPayload {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  attendeeCount: number;
  location: string | null;
}
```
`EventPayloads`: `'calendar.event': CalendarEventPayload;`

- [ ] **Step 2: Schema + union + parseRow case** — in `activity-types.ts`:

```ts
export const CalendarEventSchema = z.object({
  id: z.string(), title: z.string(), start: z.string(), end: z.string(),
  status: z.string(), attendeeCount: z.number(), location: z.string().nullable(),
});
export type CalendarEventPayload = z.infer<typeof CalendarEventSchema>;
```
Union member: `| { id: number; ts: string; kind: 'calendar_event'; payload: CalendarEventPayload }`.
`activity.ts` case mirrors the `gmail_message` case with `CalendarEventSchema`.

- [ ] **Step 3: Failing source test**

```ts
// harness with googleapis mock; declare calendarStub in vi.hoisted and return it from google.calendar
const { calendarStub } = vi.hoisted(() => ({ calendarStub: { events: { list: vi.fn() } } }));
// (adjust the googleapis mock so `calendar: vi.fn(() => calendarStub)`)
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { CalendarSource } from '../../src/main/sync/google/calendar-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { CalendarEventPayload } from '../../src/shared/events';

describe('CalendarSource', () => {
  let bus: TypedEventBus; let source: CalendarSource;
  beforeEach(() => { vi.clearAllMocks(); bus = new TypedEventBus(); source = new CalendarSource({ client: {} as never }, bus); });

  it('first snapshot fetches a syncToken and emits nothing', async () => {
    calendarStub.events.list.mockResolvedValue({ data: { items: [{ id: 'e1' }], nextSyncToken: 'tok1' } });
    const events: CalendarEventPayload[] = []; bus.on('calendar.event', (p) => events.push(p));
    const next = await source.poll(null);
    expect(next).toBe('tok1');
    expect(events).toHaveLength(0);
  });

  it('emits changed events since the syncToken and returns the new token', async () => {
    calendarStub.events.list.mockResolvedValue({ data: {
      nextSyncToken: 'tok2',
      items: [{ id: 'e1', summary: 'Standup', status: 'confirmed', location: 'Room 1',
        start: { dateTime: '2026-08-05T09:00:00Z' }, end: { dateTime: '2026-08-05T09:15:00Z' },
        attendees: [{ email: 'a@b.com' }, { email: 'c@d.com' }] }],
    } });
    const events: CalendarEventPayload[] = []; bus.on('calendar.event', (p) => events.push(p));
    const next = await source.poll('tok1');
    expect(calendarStub.events.list).toHaveBeenCalledWith(expect.objectContaining({ syncToken: 'tok1' }));
    expect(next).toBe('tok2');
    expect(events[0]).toEqual({ id: 'e1', title: 'Standup', start: '2026-08-05T09:00:00Z', end: '2026-08-05T09:15:00Z', status: 'confirmed', attendeeCount: 2, location: 'Room 1' });
  });

  it('reseeds on a 410 GONE without emitting', async () => {
    calendarStub.events.list
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 410 }))
      .mockResolvedValueOnce({ data: { items: [], nextSyncToken: 'tok3' } });
    const events: CalendarEventPayload[] = []; bus.on('calendar.event', (p) => events.push(p));
    const next = await source.poll('stale');
    expect(next).toBe('tok3');
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run → FAIL.**

- [ ] **Step 5: Implement `CalendarSource`**

```ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '../../events/bus.js';
import { SettingsData } from '../../store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

export class CalendarSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'calendar';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.calendarEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const calendar = google.calendar({ version: 'v3', auth: this.auth.client });
    const emit = cursor !== null;

    let res;
    try {
      res = await calendar.events.list(
        cursor
          ? { calendarId: 'primary', syncToken: cursor, singleEvents: true }
          : { calendarId: 'primary', singleEvents: true, orderBy: 'startTime', timeMin: new Date().toISOString() },
      );
    } catch (err) {
      if ((err as { code?: number }).code === 410) {
        const reseed = await calendar.events.list({ calendarId: 'primary', singleEvents: true, orderBy: 'startTime', timeMin: new Date().toISOString() });
        return reseed.data.nextSyncToken ?? cursor ?? '';
      }
      throw err;
    }

    if (emit) {
      for (const e of res.data.items ?? []) {
        if (!e.id) continue;
        this.eventBus.emit('calendar.event', {
          id: e.id,
          title: e.summary ?? '(no title)',
          start: e.start?.dateTime ?? e.start?.date ?? '',
          end: e.end?.dateTime ?? e.end?.date ?? '',
          status: e.status ?? 'confirmed',
          attendeeCount: (e.attendees ?? []).length,
          location: e.location ?? null,
        });
      }
    }

    return res.data.nextSyncToken ?? cursor ?? '';
  }
}
```

- [ ] **Step 6: Run → PASS.**

- [ ] **Step 7–8: Subscriber test + impl** — `CalendarActivitySubscriber` mirrors `GmailActivitySubscriber` (event `calendar.event`, kind `calendar_event`, gate key `calendarEnabled`).

- [ ] **Step 9: Run → PASS. Step 10: Commit** (`feat(sync): Calendar context source + calendar_event activity`).

---

## Task 7: Classroom source + event + activity kind + subscriber

**Files:** analogous to Task 5/6.
- Create: `app/src/main/sync/google/classroom-source.ts`, `app/src/main/activity/classroom-subscriber/classroom-subscriber.ts` + tests; modify `events.ts`, `activity-types.ts`, `activity.ts`.

**Interfaces:** Produces `ClassroomSource`, `ClassroomActivitySubscriber`, `ClassroomCourseworkPayload`, `classroom_coursework` kind. Diff via client-side `updateTime > cursor` (Classroom has no change feed).

- [ ] **Step 1: Payload + event** — `events.ts`:

```ts
export interface ClassroomCourseworkPayload {
  courseId: string;
  courseName: string;
  id: string;
  title: string;
  dueDate: string | null;
  state: string;
}
```
`EventPayloads`: `'classroom.coursework': ClassroomCourseworkPayload;`

- [ ] **Step 2: Schema + union + parseRow case** — `activity-types.ts`:

```ts
export const ClassroomCourseworkSchema = z.object({
  courseId: z.string(), courseName: z.string(), id: z.string(),
  title: z.string(), dueDate: z.string().nullable(), state: z.string(),
});
export type ClassroomCourseworkPayload = z.infer<typeof ClassroomCourseworkSchema>;
```
Union member + `activity.ts` case mirror Task 5.

- [ ] **Step 3: Failing source test**

```ts
const { classroomStub } = vi.hoisted(() => ({ classroomStub: { courses: { list: vi.fn(), courseWork: { list: vi.fn() } } } }));
// googleapis mock: classroom: vi.fn(() => classroomStub)
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ClassroomSource } from '../../src/main/sync/google/classroom-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { ClassroomCourseworkPayload } from '../../src/shared/events';

describe('ClassroomSource', () => {
  let bus: TypedEventBus; let source: ClassroomSource;
  beforeEach(() => { vi.clearAllMocks(); bus = new TypedEventBus(); source = new ClassroomSource({ client: {} as never }, bus); });

  it('first snapshot records now and emits nothing', async () => {
    const events: ClassroomCourseworkPayload[] = []; bus.on('classroom.coursework', (p) => events.push(p));
    const next = await source.poll(null);
    expect(events).toHaveLength(0);
    expect(Number.isNaN(Date.parse(next))).toBe(false); // ISO timestamp
    expect(classroomStub.courses.list).not.toHaveBeenCalled();
  });

  it('emits coursework updated after the cursor', async () => {
    classroomStub.courses.list.mockResolvedValue({ data: { courses: [{ id: 'c1', name: 'Math' }] } });
    classroomStub.courseWork.list.mockResolvedValue({ data: { courseWork: [
      { id: 'w-old', title: 'Old', state: 'PUBLISHED', updateTime: '2026-08-01T00:00:00Z' },
      { id: 'w-new', title: 'New', state: 'PUBLISHED', updateTime: '2026-08-03T00:00:00Z', dueDate: { year: 2026, month: 8, day: 10 } },
    ] } });
    const events: ClassroomCourseworkPayload[] = []; bus.on('classroom.coursework', (p) => events.push(p));
    const next = await source.poll('2026-08-02T00:00:00.000Z');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ courseId: 'c1', courseName: 'Math', id: 'w-new', title: 'New', dueDate: '2026-08-10', state: 'PUBLISHED' });
    expect(Date.parse(next)).toBeGreaterThanOrEqual(Date.parse('2026-08-03T00:00:00Z'));
  });
});
```

- [ ] **Step 4: Run → FAIL.**

- [ ] **Step 5: Implement `ClassroomSource`**

```ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '../../events/bus.js';
import { SettingsData } from '../../store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

function dueDateToISO(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!d?.year || !d.month || !d.day) return null;
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

export class ClassroomSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'classroom';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.classroomEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const now = new Date().toISOString();
    if (cursor === null) return now;

    const classroom = google.classroom({ version: 'v1', auth: this.auth.client });
    const coursesRes = await classroom.courses.list({ courseStates: ['ACTIVE'] });
    const cursorMs = Date.parse(cursor);
    let maxSeen = cursorMs;

    for (const course of coursesRes.data.courses ?? []) {
      if (!course.id) continue;
      const workRes = await classroom.courseWork.list({ courseId: course.id });
      for (const w of workRes.data.courseWork ?? []) {
        const updated = w.updateTime ? Date.parse(w.updateTime) : NaN;
        if (!Number.isFinite(updated) || updated <= cursorMs || !w.id) continue;
        if (updated > maxSeen) maxSeen = updated;
        this.eventBus.emit('classroom.coursework', {
          courseId: course.id,
          courseName: course.name ?? '',
          id: w.id,
          title: w.title ?? '(untitled)',
          dueDate: dueDateToISO(w.dueDate),
          state: w.state ?? 'PUBLISHED',
        });
      }
    }

    return Number.isFinite(maxSeen) && maxSeen > cursorMs ? new Date(maxSeen).toISOString() : now;
  }
}
```

- [ ] **Step 6: Run → PASS.**

- [ ] **Step 7–8: Subscriber test + impl** — `ClassroomActivitySubscriber` mirrors Task 5 (event `classroom.coursework`, kind `classroom_coursework`, gate `classroomEnabled`).

- [ ] **Step 9: Run → PASS. Step 10: Commit** (`feat(sync): Classroom context source + classroom_coursework activity`).

---

## Task 8: Settings toggles for the new sources

**Files:**
- Modify: `app/src/main/store/repos/settings.ts` (interface + `getAll` + `update`)
- Modify: `app/tests/store/settings-repo.test.ts`

**Interfaces:** Adds `gmailEnabled`, `calendarEnabled`, `classroomEnabled: boolean` to `SettingsData` (default **true** via `!== 'false'`).

- [ ] **Step 1: Failing test** — add to `settings-repo.test.ts`:

```ts
it('defaults the new Google source toggles to on', () => {
  const s = settingsRepo.getAll();
  expect(s.gmailEnabled).toBe(true);
  expect(s.calendarEnabled).toBe(true);
  expect(s.classroomEnabled).toBe(true);
});

it('persists a false toggle', () => {
  settingsRepo.update({ gmailEnabled: false });
  expect(settingsRepo.getAll().gmailEnabled).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL** (properties missing).

- [ ] **Step 3: Implement** — in `SettingsData` add the three booleans. In `getAll`, add:

```ts
const gmailEnabled = map.get('gmailEnabled') !== 'false';
const calendarEnabled = map.get('calendarEnabled') !== 'false';
const classroomEnabled = map.get('classroomEnabled') !== 'false';
```
Return them in the object. In `update`, add three blocks mirroring `gdocsPollingEnabled`:

```ts
if (patch.gmailEnabled !== undefined) this.set('gmailEnabled', String(patch.gmailEnabled));
if (patch.calendarEnabled !== undefined) this.set('calendarEnabled', String(patch.calendarEnabled));
if (patch.classroomEnabled !== undefined) this.set('classroomEnabled', String(patch.classroomEnabled));
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** (`feat(store): add Gmail/Calendar/Classroom source toggles`).

---

## Task 9: Extend Drive/Docs poller to emit revision id + title

**Files:**
- Modify: `app/src/main/sync/gdocs-poller.ts` (request `version` + include title already present)
- Modify: `app/src/shared/events.ts` (`GDocsRevisionPayload` — add optional `revisionId?: string`)
- Modify: `app/src/main/store/repos/activity-types.ts` (`GDocsRevisionSchema` — add `revisionId: z.string().optional()`)
- Modify: `app/tests/sync/gdocs-poller.test.ts`

**Interfaces:** `GDocsRevisionPayload` gains optional `revisionId`. Backward compatible — existing rows still parse.

- [ ] **Step 1: Failing test** — extend the "emits events" test to assert `revisionId` when the Drive `files.list` response includes `headRevisionId`, and add `headRevisionId` to the `fields` assertion.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — in `gdocs-poller.ts` change the `fields` to `files(id, name, modifiedTime, headRevisionId)` and include `revisionId: file.headRevisionId ?? undefined` in the emitted payload. Add `revisionId: z.string().optional()` to `GDocsRevisionSchema` and `revisionId?: string` to `GDocsRevisionPayload`. Update the `gdocs-subscriber` to pass `revisionId` through.

- [ ] **Step 4: Run → PASS. Step 5: Commit** (`feat(sync): include doc revisionId in gdocs revisions`).

---

## Task 10: Wire pollers + subscribers into the app; feed Inference

**Files:**
- Modify: `app/src/main/index.ts` (construct + start the three `SourcePoller`s and subscribers, stop them on quit; mirror the `gdocsPoller` lifecycle at `index.ts:126-127,162-163`)
- Modify: `app/src/main/store/index.ts` (export `syncCursors` if not already from Task 4)
- Modify: the inference/planner activity-kind allowlist (locate via grep)
- No new test file; covered by an integration smoke assertion in an existing wiring test if present.

**Interfaces:** Consumes everything above. Preflight for each Google `SourcePoller` is `() => googleAuth.isAuthorized()`.

- [ ] **Step 1: Locate the inference/planner kind list**

Run: `grep -rn "gdocs_revision\|git_commit" app/src/main/activity/inference app/src/main/planner`
Add `gmail_message`, `calendar_event`, `classroom_coursework` wherever `gdocs_revision` is enumerated as a context-relevant kind (e.g. an array of kinds the inference context builder reads). If inference reads *all* kinds unfiltered, no change is needed — note that in the commit message.

- [ ] **Step 2: Wire lifecycle in `index.ts`**

After the existing `gdocsPoller` construction, add (using the shared `eventBus`, `settingsRepo`, `activityRepo`, `googleAuth`, and new `syncCursors`):

```ts
import { SourcePoller } from './sync/source-poller.js';
import { GmailSource } from './sync/google/gmail-source.js';
import { CalendarSource } from './sync/google/calendar-source.js';
import { ClassroomSource } from './sync/google/classroom-source.js';
import { GmailActivitySubscriber } from './activity/gmail-subscriber/gmail-subscriber.js';
import { CalendarActivitySubscriber } from './activity/calendar-subscriber/calendar-subscriber.js';
import { ClassroomActivitySubscriber } from './activity/classroom-subscriber/classroom-subscriber.js';

const preflight = () => googleAuth.isAuthorized();
const googlePollers = [
  new SourcePoller(new GmailSource(googleAuth, eventBus), syncCursors, settingsRepo, 5 * 60 * 1000, preflight),
  new SourcePoller(new CalendarSource(googleAuth, eventBus), syncCursors, settingsRepo, 5 * 60 * 1000, preflight),
  new SourcePoller(new ClassroomSource(googleAuth, eventBus), syncCursors, settingsRepo, 30 * 60 * 1000, preflight),
];
const googleSubscribers = [
  new GmailActivitySubscriber(activityRepo, settingsRepo, eventBus),
  new CalendarActivitySubscriber(activityRepo, settingsRepo, eventBus),
  new ClassroomActivitySubscriber(activityRepo, settingsRepo, eventBus),
];
googleSubscribers.forEach((s) => s.start());
googlePollers.forEach((p) => p.start());
```

In the quit/cleanup block (next to `gdocsPoller.stop()` at `index.ts:162-163`), add `googlePollers.forEach((p) => p.stop()); googleSubscribers.forEach((s) => s.stop());`.

Note: `GmailSource` etc. take `googleAuth` directly because `GoogleAuth` exposes `client` — it satisfies `{ client: OAuth2Client }`.

- [ ] **Step 3: Verify** — `pnpm --filter ./app run typecheck` clean; `pnpm --filter ./app test` green.

- [ ] **Step 4: Commit** (`feat: wire Google context sources + subscribers into app lifecycle`).

---

## Task 11: Settings + connect UI (replace "coming soon")

**Files:**
- Modify: `app/src/renderer/overlay/steps/StepConnect/StepConnect.tsx` (real one-click "Connect Google")
- Modify: the Settings page that renders tracking toggles (locate: `grep -rn "gdocsPollingEnabled" app/src/renderer`)
- IPC: reuse existing `google:connect` / `google:disconnect`; add settings toggle plumbing mirroring `gdocsPollingEnabled` if a per-source UI toggle is desired.

**Interfaces:** UI only; no new main-process types. UI scaffolding is exempt from TDD per CLAUDE.md — verify visually via the `run` skill.

- [ ] **Step 1:** In `StepConnect.tsx`, replace the Google "coming soon" branch with a button calling the existing `google:connect` IPC; on success show connected state. Copy: note Gmail/Classroom are "pending Google review" until verification clears.
- [ ] **Step 2:** In Settings, add per-source toggles bound to `gmailEnabled`/`calendarEnabled`/`classroomEnabled` via the existing settings-update IPC, mirroring the `gdocsPollingEnabled` toggle.
- [ ] **Step 3: Verify** — `pnpm --filter ./app run typecheck && pnpm --filter ./app run lint`; launch via the `run` skill and confirm the connect flow renders. Do not assert screenshots in unit tests.
- [ ] **Step 4: Commit** (`feat(ui): one-click Google connect + per-source toggles`).

---

## Final verification (run before declaring the plan complete)

- [ ] `pnpm typecheck && pnpm lint && pnpm test` from repo root — all green.
- [ ] Manual: connect Google in dev (per `docs/RUNNING.md`), confirm first connect writes cursors but no backlog activity; edit a doc / receive mail, confirm the next poll writes exactly the new diffs.

## Self-review notes (author)

- Spec coverage: S1 (sync_cursors)→T1; S2 (scaffold)→T2; S3 (allowlist)→T3; scope expansion + connect→T4; Gmail→T5; Calendar→T6; Classroom→T7; settings→T8; Drive extension→T9; inference wiring + lifecycle→T10; UI→T11. All MCP-Phase-1 spec subtasks are covered.
- Type consistency: `ContextSource.poll(cursor: string | null): Promise<string>` is the single seam used by every source and by `SourcePoller`. Payload/schema/union names match across `events.ts`, `activity-types.ts`, `activity.ts`, and each subscriber's `gate` key.
- First-snapshot rule is enforced identically in every source (`cursor === null` → seed + emit nothing) and asserted in each source test.

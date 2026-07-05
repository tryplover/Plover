import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@main/store/db.js';
import { ActivityRepo } from '@main/store/repos/activity.js';

describe('ActivityRepo', () => {
  it('inserts and retrieves activity rows', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const now = new Date().toISOString();
    const row = repo.insert({
      kind: 'file_modified',
      payload: { path: '/home/test.txt', kind: 'md' },
      ts: now,
    });

    expect(row.id).toBeDefined();
    expect(row.ts).toBe(now);
    expect(row.kind).toBe('file_modified');
    expect(row.payload).toEqual({ path: '/home/test.txt', kind: 'md' });
  });

  it('listSince returns rows after a given timestamp', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const t1 = '2026-01-01T10:00:00.000Z';
    const t2 = '2026-01-01T10:05:00.000Z';
    const t3 = '2026-01-01T10:10:00.000Z';

    repo.insert({ kind: 'file_modified', payload: { path: '/file1.txt', kind: 'md' }, ts: t1 });
    repo.insert({ kind: 'file_added', payload: { path: '/file2.txt', kind: 'md' }, ts: t2 });
    repo.insert({ kind: 'file_modified', payload: { path: '/file3.txt', kind: 'md' }, ts: t3 });

    const result = repo.listSince(t2);
    expect(result).toHaveLength(2);
    const [r0, r1] = result;
    expect(r0?.kind).toBe('file_added');
    expect(r1?.kind).toBe('file_modified');
    expect((r0?.payload as { path: string }).path).toBe('/file2.txt');
  });

  it('listBetween returns rows within a time range', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const t1 = '2026-01-01T10:00:00.000Z';
    const t2 = '2026-01-01T10:05:00.000Z';
    const t3 = '2026-01-01T10:10:00.000Z';
    const t4 = '2026-01-01T10:15:00.000Z';

    repo.insert({ kind: 'file_modified', payload: { path: '/file1.txt', kind: 'md' }, ts: t1 });
    repo.insert({ kind: 'file_added', payload: { path: '/file2.txt', kind: 'md' }, ts: t2 });
    repo.insert({ kind: 'file_modified', payload: { path: '/file3.txt', kind: 'md' }, ts: t3 });
    repo.insert({ kind: 'file_added', payload: { path: '/file4.txt', kind: 'md' }, ts: t4 });

    const result = repo.listBetween(t2, t3);
    expect(result).toHaveLength(2);
    const [r0, r1] = result;
    expect(r0?.kind).toBe('file_added');
    expect(r1?.kind).toBe('file_modified');
    expect((r0?.payload as { path: string }).path).toBe('/file2.txt');
    expect((r1?.payload as { path: string }).path).toBe('/file3.txt');
  });

  it('generates timestamps if not provided', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const row = repo.insert({
      kind: 'file_modified',
      payload: { path: '/test.txt' },
    });

    expect(row.ts).toBeDefined();
    const ts = new Date(row.ts);
    expect(ts.getTime()).not.toBeNaN();
  });

  it('stores and retrieves complex JSON payloads', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const complexPayload = {
      path: '/test/file.md',
      kind: 'md',
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
    };

    repo.insert({
      kind: 'file_modified',
      payload: complexPayload,
    });

    const [retrieved] = repo.listSince('2026-01-01T00:00:00.000Z');
    expect(retrieved?.payload).toEqual(complexPayload);
  });
});

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

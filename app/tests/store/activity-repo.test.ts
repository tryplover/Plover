import { describe, expect, it } from 'vitest';
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

    repo.insert({ kind: 'file_modified', payload: { x: 1 }, ts: t1 });
    repo.insert({ kind: 'file_added', payload: { x: 2 }, ts: t2 });
    repo.insert({ kind: 'file_modified', payload: { x: 3 }, ts: t3 });

    const result = repo.listSince(t2);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('file_added');
    expect(result[1].kind).toBe('file_modified');
    expect((result[0].payload as { x: number }).x).toBe(2);
  });

  it('listBetween returns rows within a time range', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repo = new ActivityRepo(db);

    const t1 = '2026-01-01T10:00:00.000Z';
    const t2 = '2026-01-01T10:05:00.000Z';
    const t3 = '2026-01-01T10:10:00.000Z';
    const t4 = '2026-01-01T10:15:00.000Z';

    repo.insert({ kind: 'file_modified', payload: { x: 1 }, ts: t1 });
    repo.insert({ kind: 'file_added', payload: { x: 2 }, ts: t2 });
    repo.insert({ kind: 'file_modified', payload: { x: 3 }, ts: t3 });
    repo.insert({ kind: 'file_added', payload: { x: 4 }, ts: t4 });

    const result = repo.listBetween(t2, t3);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('file_added');
    expect(result[1].kind).toBe('file_modified');
    expect((result[0].payload as { x: number }).x).toBe(2);
    expect((result[1].payload as { x: number }).x).toBe(3);
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

    const row = repo.insert({
      kind: 'file_modified',
      payload: complexPayload,
    });

    const retrieved = repo.listSince('2026-01-01T00:00:00.000Z')[0];
    expect(retrieved.payload).toEqual(complexPayload);
  });
});

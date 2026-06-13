import { describe, expect, it } from 'vitest';
import { parseChecklists } from '@main/activity/markdown-parser.js';

describe('markdown-parser', () => {
  it('parses unchecked items', () => {
    const md = '- [ ] Task 1\n- [ ] Task 2';
    const items = parseChecklists(md);

    expect(items).toHaveLength(2);
    const [i0, i1] = items;
    expect(i0?.title).toBe('Task 1');
    expect(i0?.completed).toBe(false);
    expect(i0?.line).toBe(1);

    expect(i1?.title).toBe('Task 2');
    expect(i1?.completed).toBe(false);
    expect(i1?.line).toBe(2);
  });

  it('parses checked items (lowercase x)', () => {
    const md = '- [x] Done task';
    const items = parseChecklists(md);

    expect(items).toHaveLength(1);
    const [i0] = items;
    expect(i0?.title).toBe('Done task');
    expect(i0?.completed).toBe(true);
    expect(i0?.line).toBe(1);
  });

  it('parses checked items (uppercase X)', () => {
    const md = '- [X] Done task';
    const items = parseChecklists(md);

    expect(items).toHaveLength(1);
    const [i0] = items;
    expect(i0?.title).toBe('Done task');
    expect(i0?.completed).toBe(true);
    expect(i0?.line).toBe(1);
  });

  it('handles mixed indentation', () => {
    const md = '- [ ] Task A\n  - [ ] Subtask\n- [x] Task B';
    const items = parseChecklists(md);

    expect(items).toHaveLength(3);
    const [i0, i1, i2] = items;
    expect(i0?.title).toBe('Task A');
    expect(i0?.line).toBe(1);

    expect(i1?.title).toBe('Subtask');
    expect(i1?.line).toBe(2);

    expect(i2?.title).toBe('Task B');
    expect(i2?.completed).toBe(true);
    expect(i2?.line).toBe(3);
  });

  it('handles extra spaces in checkbox', () => {
    const md = '-  [ ]  Task with spaces';
    const items = parseChecklists(md);

    expect(items).toHaveLength(1);
    const [i0] = items;
    expect(i0?.title).toBe('Task with spaces');
    expect(i0?.completed).toBe(false);
  });

  it('ignores non-checkbox lines', () => {
    const md = 'Regular text\n- [ ] Real task\nMore text\n- [x] Done\nNo checkbox';
    const items = parseChecklists(md);

    expect(items).toHaveLength(2);
    const [i0, i1] = items;
    expect(i0?.title).toBe('Real task');
    expect(i1?.title).toBe('Done');
  });

  it('handles correct line numbers with mixed content', () => {
    const md = 'Header\n- [ ] Line 2\nText\n- [x] Line 4';
    const items = parseChecklists(md);

    expect(items).toHaveLength(2);
    const [i0, i1] = items;
    expect(i0?.line).toBe(2);
    expect(i1?.line).toBe(4);
  });

  it('returns empty array for empty input', () => {
    const items = parseChecklists('');
    expect(items).toHaveLength(0);
  });

  it('returns empty array when no checkboxes found', () => {
    const md = 'Just regular text\nNo checkboxes here\n- Not a checkbox\n[ ] Not a list';
    const items = parseChecklists(md);
    expect(items).toHaveLength(0);
  });

  it('preserves task title formatting', () => {
    const md = '- [ ] Task with **bold** and _italic_\n- [x] Task with `code`';
    const items = parseChecklists(md);

    expect(items).toHaveLength(2);
    const [i0, i1] = items;
    expect(i0?.title).toBe('Task with **bold** and _italic_');
    expect(i1?.title).toBe('Task with `code`');
  });

  it('trims leading/trailing whitespace from titles', () => {
    const md = '- [ ]   Task with spaces   ';
    const items = parseChecklists(md);

    expect(items).toHaveLength(1);
    const [i0] = items;
    expect(i0?.title).toBe('Task with spaces');
  });
});

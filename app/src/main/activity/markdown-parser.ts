export interface ChecklistItem {
  title: string;
  completed: boolean;
  line: number;
}

export function parseChecklists(md: string): ChecklistItem[] {
  const lines = md.split('\n');
  const items: ChecklistItem[] = [];

  for (const [i, line] of lines.entries()) {
    const uncheckedMatch = line.match(/^\s*[-*+]\s*\[\s*\]\s+(.+)$/i);
    if (uncheckedMatch) {
      const title = (uncheckedMatch[1] ?? '').trim();
      if (title) {
        items.push({ title, completed: false, line: i + 1 });
      }
      continue;
    }

    const checkedMatch = line.match(/^\s*[-*+]\s*\[x\]\s+(.+)$/i);
    if (checkedMatch) {
      const title = (checkedMatch[1] ?? '').trim();
      if (title) {
        items.push({ title, completed: true, line: i + 1 });
      }
    }
  }

  return items;
}

export interface ChecklistItem {
  title: string;
  completed: boolean;
  line: number;
}

export function parseChecklists(md: string): ChecklistItem[] {
  const lines = md.split('\n');
  const items: ChecklistItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === undefined) {
      continue;
    }

    const uncheckedMatch = line.match(/^\s*-\s*\[\s*\]\s+(.+)$/i);
    if (uncheckedMatch) {
      const title = uncheckedMatch[1];
      items.push({
        title,
        completed: false,
        line: i + 1,
      });
      continue;
    }

    const checkedMatch = line.match(/^\s*-\s*\[x\]\s+(.+)$/i);
    if (checkedMatch) {
      const title = checkedMatch[1];
      items.push({
        title,
        completed: true,
        line: i + 1,
      });
      continue;
    }
  }

  return items;
}

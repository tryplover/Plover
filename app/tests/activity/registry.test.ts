import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVITY_KINDS } from '../../src/shared/activity-kinds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcMainPath = path.resolve(__dirname, '../../src/main');

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const res = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      walkDir(res, callback);
    } else if (file.isFile() && /\.(ts|js|tsx|jsx)$/.test(file.name)) {
      callback(res);
    }
  }
}

describe('Activity Registry', () => {
  it('should contain all kinds used in the codebase', () => {
    const foundKinds = new Set<string>();
    const lineRegex = /(activityRepo\.(log|insert|list))\s*\(\s*\{\s*kind:|activityRepo\.log\s*\('/;
    const kindRegex = /(?:kind:\s*'|log\s*\(')([^']+)'/g;

    walkDir(srcMainPath, (filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (lineRegex.test(line)) {
          let match;
          kindRegex.lastIndex = 0;
          while ((match = kindRegex.exec(line)) !== null) {
            if (match[1]) {
              foundKinds.add(match[1]);
            }
          }
        }
      }
    });

    const registeredKinds = new Set(ACTIVITY_KINDS.map((k) => k.kind));

    const missingKinds = Array.from(foundKinds).filter((k) => !registeredKinds.has(k));

    expect(missingKinds, `Kinds found in code but missing from registry: ${missingKinds.join(', ')}`).toHaveLength(0);
  });

  it('should have unique kinds in the registry', () => {
    const kinds = ACTIVITY_KINDS.map((k) => k.kind);
    const uniqueKinds = new Set(kinds);
    expect(kinds.length).toBe(uniqueKinds.size);
  });
});

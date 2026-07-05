import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { ACTIVITY_KINDS } from '../../src/shared/activity-kinds.js';

describe('Activity Registry', () => {
  it('should contain all kinds used in the codebase', () => {
    // Grep for activityRepo.log('kind', ...) or activityRepo.insert({ kind: 'kind', ... })
    // and similar patterns in src/main
    // Filter out console.log and other generic logs
    const grepOutput = execSync(
      "grep -rhE \"(activityRepo\\\\.log|activityRepo\\\\.insert|activityRepo\\\\.list)\\\\s*\\\\(\\\\s*{\\\\s*kind:|activityRepo\\\\.log\\\\s*\\\\('\" src/main",
      { encoding: 'utf8' }
    );

    const kindRegex = /(?:kind:\s*'|log\s*\(')([^']+)'/g;
    const foundKinds = new Set<string>();
    let match;
    while ((match = kindRegex.exec(grepOutput)) !== null) {
      if (match[1]) {
        foundKinds.add(match[1]);
      }
    }

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

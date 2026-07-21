import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(__dirname, '../../src/renderer/index.css'), 'utf8');

const expected: Record<string, string> = {
  '--plover-bg': '#141517',
  '--plover-surface': '#1e2024',
  '--plover-text': '#f4f4f6',
  '--plover-mint': '#8ce0af',
  '--plover-radius-xl': '28px',
  '--plover-duration-normal': '220ms',
};

describe('design tokens', () => {
  for (const [name, value] of Object.entries(expected)) {
    it(`declares ${name} as ${value}`, () => {
      const pattern = new RegExp(
        `${name}:\\s*${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')};`,
      );
      expect(CSS).toMatch(pattern);
    });
  }
});

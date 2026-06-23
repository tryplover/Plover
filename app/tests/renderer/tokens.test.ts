import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(
  resolve(__dirname, '../../src/renderer/index.css'),
  'utf8',
);

const expected: Record<string, string> = {
  '--plover-bg': '#0a0b0b',
  '--plover-surface': '#141516',
  '--plover-text': '#f1ecdf',
  '--plover-mint': '#b7e4c7',
  '--plover-radius-xl': '28px',
  '--plover-duration-normal': '220ms',
};

describe('design tokens', () => {
  for (const [name, value] of Object.entries(expected)) {
    it(`declares ${name} as ${value}`, () => {
      const pattern = new RegExp(`${name}:\\s*${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')};`);
      expect(CSS).toMatch(pattern);
    });
  }
});

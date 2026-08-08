import { describe, expect, it } from 'vitest';
import { assertAllowedHost, ALLOWED_HOSTS } from '../../src/main/http/allowlist';

describe('assertAllowedHost', () => {
  it('allows the enumerated hosts', () => {
    for (const host of ['gmail.googleapis.com', 'www.googleapis.com', 'calendar.googleapis.com', 'classroom.googleapis.com', 'generativelanguage.googleapis.com', 'api.github.com']) {
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

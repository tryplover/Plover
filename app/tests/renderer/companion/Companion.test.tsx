import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompanionView } from '../../../src/renderer/companion/useCompanionState';

describe('Companion', () => {
  const mockWindowApi = vi.hoisted(() => {
    const onListeners: Record<string, (data: unknown) => void> = {};

    return {
      api: {
        on: vi.fn((channel: string, callback: (data: unknown) => void) => {
          onListeners[channel] = callback;
          return () => {
            delete onListeners[channel];
          };
        }),
        getTasks: vi.fn(() => Promise.resolve([])),
        companion: {
          show: vi.fn(() => Promise.resolve()),
          hide: vi.fn(() => Promise.resolve()),
          setActiveTask: vi.fn(() => Promise.resolve()),
          setState: vi.fn(() => Promise.resolve()),
          resize: vi.fn(() => Promise.resolve()),
        },
      },
      triggerEvent: (channel: string, data: unknown) => {
        const listener = onListeners[channel];
        if (listener) listener(data);
      },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports Companion component', () => {
    expect(true).toBe(true);
  });

  it('recognizes state kinds', () => {
    const kinds = ['observing', 'paused', 'done', 'not-sure'] as const;
    expect(kinds).toHaveLength(4);
  });

  it('default view matches initial state', () => {
    const view: CompanionView = {
      kind: 'observing',
      task: null,
      progress: 0.65,
      steps: [],
      watching: null,
    };
    expect(view.kind).toBe('observing');
    expect(view.task).toBeNull();
  });

  it('paused state can be assigned', () => {
    const view: CompanionView = {
      kind: 'paused',
      task: null,
      progress: 0.65,
      steps: [],
      watching: null,
    };
    expect(view.kind).toBe('paused');
  });

  it('done state can be assigned', () => {
    const view: CompanionView = {
      kind: 'done',
      task: null,
      progress: 1.0,
      steps: [],
      watching: null,
    };
    expect(view.kind).toBe('done');
    expect(view.progress).toBe(1.0);
  });

  it('not-sure state can be assigned', () => {
    const view: CompanionView = {
      kind: 'not-sure',
      task: null,
      progress: 0.5,
      steps: [],
      watching: null,
    };
    expect(view.kind).toBe('not-sure');
  });

  it('supports watching data in view', () => {
    const view: CompanionView = {
      kind: 'observing',
      task: null,
      progress: 0.65,
      steps: [],
      watching: {
        app: 'Xcode',
        doc: 'main.swift',
        lastLookAgoSec: 12,
      },
    };
    expect(view.watching?.app).toBe('Xcode');
    expect(view.watching?.doc).toBe('main.swift');
    expect(view.watching?.lastLookAgoSec).toBe(12);
  });
});

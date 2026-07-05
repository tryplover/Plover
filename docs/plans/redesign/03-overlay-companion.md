# PR-03 · Overlay companion + state set

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`.

**Goal:** Add the persistent **collapsed companion** (the always-on-top pill
showing `observing · Draft — methods · 65%`) and the **expanded card** that
appears when the user clicks it. Includes the four state transitions:
`observing ↔ paused ↔ done ↔ not-sure` (pages 5–6 of the moodboard).

**Architecture:** The companion lives in its own Electron `BrowserWindow`,
separate from the existing setup overlay (which PR-04 redesigns). The
collapsed and expanded views are the same React app — only the window size
animates between two heights. State is driven by a renderer-local store
seeded with placeholder data from the existing `Tasks` IPC API; **no
Phase 2 monitoring is wired in this PR**. The "watched window" data and the
progress percentage come from the active task's existing `progress_signal`
column (or default to 0 / 0.65 placeholder if absent).

**Tech stack:** Electron `BrowserWindow`, framer-motion, the PR-02
component library.

## Phase scope reminder

The companion's *presence* (the moodboard pill) is part of the Phase 1
redesign. Its *behaviour* (live progress signals derived from window
activity) belongs to Phase 2's Monitor + Inference modules. This PR ships
the chrome and the state machine, wired to whatever signal already exists
in `tasks.progress_signal`; if that column is null, the bar reads from
manual progress (steps completed / total). See
[`store-layer.md`](../../superpowers/specs/phase-1/store-layer.md) for the
schema.

## Global constraints

- The companion window is **frameless, non-resizable, transparent,
  always-on-top, click-through-disabled**, and uses
  `vibrancy: 'under-window'` on macOS.
- No Screen Recording or Accessibility permission is requested by this
  PR (deferred to Phase 2 — see CLAUDE.md hard constraints).
- The companion's visible content respects `prefers-reduced-motion`:
  no infinite pulse, no spring scale.

---

## Files

- Modify: `app/src/main/index.ts` — register the new companion window
  factory + lifecycle.
- Create: `app/src/main/windows/companion.ts` — `BrowserWindow` factory
  for the companion. Returns a managed instance that exposes `show`,
  `hide`, `resize(height)`, `position(corner)`.
- Modify: `app/src/main/ipc.ts` — wire IPC for companion state
  (show/hide, set active task, set state-kind).
- Modify: `app/src/preload/index.ts` — expose new IPC channels on
  `window.api`.
- Modify: `app/electron.vite.config.ts` — add a new HTML entry
  `companion.html` so the companion window has its own bundle.
- Create: `app/src/renderer/companion/index.html`
- Create: `app/src/renderer/companion/main.tsx` — companion entry.
- Create: `app/src/renderer/companion/Companion.tsx` — the React root
  that toggles between collapsed and expanded.
- Create: `app/src/renderer/companion/Collapsed.tsx`
- Create: `app/src/renderer/companion/Expanded.tsx`
- Create: `app/src/renderer/companion/useCompanionState.ts` — the
  state-set hook (observing / paused / done / not-sure) plus the
  task-selection store.
- Create: `app/tests/renderer/companion/Companion.test.tsx`
- Create: `app/tests/renderer/companion/useCompanionState.test.ts`

## Interfaces (consumed by PR-04 / PR-05)

```ts
// preload contract (additions)
declare global {
  interface Window {
    api: {
      // ...existing surface...
      companion: {
        show: () => Promise<void>;
        hide: () => Promise<void>;
        setActiveTask: (taskId: string | null) => Promise<void>;
        setState: (kind: import('./companion/useCompanionState').StateKind) => Promise<void>;
        resize: (height: number) => Promise<void>;
      };
    };
  }
}

// renderer state-set
export type StateKind = 'observing' | 'paused' | 'done' | 'not-sure';
```

## Tasks

### Task 03.1 — Companion `BrowserWindow` factory

- [ ] Create `app/src/main/windows/companion.ts`:

  ```ts
  import { BrowserWindow, screen } from 'electron';
  import { join } from 'node:path';

  const COLLAPSED_HEIGHT = 56;
  const COLLAPSED_WIDTH = 360;

  export function createCompanionWindow(): BrowserWindow {
    const { workArea } = screen.getPrimaryDisplay();
    const win = new BrowserWindow({
      width: COLLAPSED_WIDTH,
      height: COLLAPSED_HEIGHT,
      x: workArea.x + workArea.width - COLLAPSED_WIDTH - 24,
      y: workArea.y + 24,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      vibrancy: 'under-window',
      visualEffectState: 'active',
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        sandbox: true,
        contextIsolation: true,
      },
    });

    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/companion.html`);
    } else {
      void win.loadFile(join(import.meta.dirname, '../renderer/companion.html'));
    }
    return win;
  }
  ```

- [ ] Update `app/electron.vite.config.ts` `renderer.build.rollupOptions.input`
  to include both `index.html` and `src/renderer/companion/index.html`.
  Externals stay the same as in lessons-learned `2026-05-31`.

- [ ] Commit `feat(main): companion BrowserWindow factory`.

### Task 03.2 — Wire IPC

- [ ] In `app/src/main/ipc.ts` add a `companion` handler block that
  manages a singleton instance:

  ```ts
  let companion: BrowserWindow | null = null;

  function ensureCompanion(): BrowserWindow {
    if (!companion || companion.isDestroyed()) {
      companion = createCompanionWindow();
      companion.on('closed', () => { companion = null; });
    }
    return companion;
  }

  ipcMain.handle('companion:show', () => { ensureCompanion().show(); });
  ipcMain.handle('companion:hide', () => companion?.hide());
  ipcMain.handle('companion:resize', (_e, height: number) => {
    const w = ensureCompanion();
    const [width] = w.getSize();
    w.setSize(width, Math.max(56, Math.min(640, Math.round(height))));
  });
  ipcMain.handle('companion:setActiveTask', (_e, taskId: string | null) => {
    ensureCompanion().webContents.send('companion:activeTask', taskId);
  });
  ipcMain.handle('companion:setState', (_e, kind: string) => {
    ensureCompanion().webContents.send('companion:state', kind);
  });
  ```

- [ ] Mirror these on `window.api.companion.*` in
  `app/src/preload/index.ts`.

- [ ] Commit `feat(ipc): companion lifecycle channels`.

### Task 03.3 — `useCompanionState` hook

The renderer-side state machine. No IPC for now beyond receiving
push events.

- [ ] Create `app/src/renderer/companion/useCompanionState.ts`:

  ```ts
  import { useEffect, useState } from 'react';
  import type { Task } from '../../shared/types';

  export type StateKind = 'observing' | 'paused' | 'done' | 'not-sure';

  export interface CompanionView {
    kind: StateKind;
    task: Task | null;
    progress: number; // 0–1
    steps: { id: string; label: string; done: boolean; current: boolean }[];
    watching: { app: string; doc: string; lastLookAgoSec: number } | null;
  }

  export function useCompanionState(): CompanionView {
    const [view, setView] = useState<CompanionView>({
      kind: 'observing',
      task: null,
      progress: 0.65, // placeholder until Phase 2 inference
      steps: [],
      watching: null,
    });

    useEffect(() => {
      const offTask = window.api.on('companion:activeTask', async (taskId: unknown) => {
        const id = taskId as string | null;
        if (!id) return setView((v) => ({ ...v, task: null, steps: [] }));
        const tasks = await window.api.getTasks();
        const task = tasks.find((t) => t.id === id) ?? null;
        setView((v) => ({ ...v, task, steps: buildSteps(task, tasks) }));
      });
      const offState = window.api.on('companion:state', (kind: unknown) => {
        setView((v) => ({ ...v, kind: kind as StateKind }));
      });
      return () => { offTask(); offState(); };
    }, []);

    return view;
  }

  function buildSteps(task: Task | null, all: Task[]): CompanionView['steps'] {
    if (!task) return [];
    const siblings = all.filter((t) => t.goal_id === task.goal_id).sort(/* order */);
    const currentIdx = siblings.findIndex((t) => t.id === task.id);
    return siblings.map((t, i) => ({
      id: t.id,
      label: t.title,
      done: t.status === 'done',
      current: i === currentIdx,
    }));
  }
  ```

  (Sort comparator: by `scheduled_start` ascending, fallback to `id`.)

- [ ] Test renders the hook with `act()` + mocked `window.api`,
  pushes a `companion:activeTask` event, asserts the returned view
  updates the task and step list. Mock IPC with `vi.hoisted`.

- [ ] Commit `feat(companion): state-set + step-derivation hook`.

### Task 03.4 — `Collapsed.tsx`

The pill. Uses `StatusIndicator` + `ProgressLine`. Click expands.

- [ ] Create `Collapsed.tsx`:

  ```tsx
  import { motion } from '../lib/motion';
  import { StatusIndicator } from '../components/StatusIndicator';
  import { ProgressLine } from '../components/ProgressLine';
  import './Collapsed.css';
  import type { CompanionView } from './useCompanionState';

  interface Props {
    view: CompanionView;
    onExpand: () => void;
  }

  export function Collapsed({ view, onExpand }: Props) {
    const label = stateLabel(view.kind);
    return (
      <motion.button
        className="plover-collapsed"
        onClick={onExpand}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
      >
        <StatusIndicator kind={view.kind} label={label} />
        <span className="plover-collapsed__sep" aria-hidden>·</span>
        <span className="plover-collapsed__title">{view.task?.title ?? 'No active task'}</span>
        <span className="plover-collapsed__pct">{Math.round(view.progress * 100)}%</span>
        <ProgressLine value={view.progress} animate />
      </motion.button>
    );
  }

  function stateLabel(k: CompanionView['kind']) {
    switch (k) {
      case 'observing': return 'observing';
      case 'paused':    return 'paused';
      case 'done':      return 'Done';
      case 'not-sure':  return 'not sure';
    }
  }
  ```

- [ ] CSS: radius `var(--plover-radius-xl)`, padding `10px 18px`,
  background `rgba(20,21,22,0.78)` with `backdrop-filter: blur(24px)`,
  shadow `var(--plover-shadow-pill)`. Percentage uses
  `var(--plover-font-serif)`. The `ProgressLine` is `position:absolute`
  along the bottom edge of the pill.

- [ ] Commit `feat(companion): collapsed pill view`.

### Task 03.5 — `Expanded.tsx`

The card with header + segmented progress + step list + watching footer.

- [ ] Create `Expanded.tsx`:

  ```tsx
  import { AnimatePresence, motion } from '../lib/motion';
  import { StatusIndicator } from '../components/StatusIndicator';
  import { StepRow } from '../components/StepRow';
  import { Button } from '../components/Button';
  import './Expanded.css';
  import type { CompanionView } from './useCompanionState';

  interface Props {
    view: CompanionView;
    onCollapse: () => void;
  }

  export function Expanded({ view, onCollapse }: Props) {
    return (
      <motion.section
        className="plover-expanded"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <header className="plover-expanded__header">
          <StatusIndicator kind={view.kind} label={stateLabel(view.kind)} />
          <button className="plover-expanded__close" onClick={onCollapse}>···</button>
        </header>

        <h1 className="plover-expanded__title">{view.task?.title ?? 'No active task'}</h1>
        <p className="plover-expanded__meta">Today · one-off task</p>
        <span className="plover-expanded__pct">{Math.round(view.progress * 100)}%</span>

        <div className="plover-expanded__segments" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} data-filled={i / 6 < view.progress ? 'true' : 'false'} />
          ))}
        </div>

        <ul className="plover-expanded__steps">
          {view.steps.map((s) => (
            <li key={s.id}>
              <StepRow
                label={s.label}
                state={s.done ? 'done' : s.current ? 'current' : 'pending'}
                trailing={s.current ? <span className="plover-now">now</span> : null}
              />
            </li>
          ))}
        </ul>

        {view.watching && (
          <footer className="plover-expanded__watching">
            <span>👁  Watching this window only</span>
            <p>{view.watching.app}</p>
            <p>Last look {view.watching.lastLookAgoSec}s ago · never saved
              <Button variant="secondary">Change</Button>
            </p>
          </footer>
        )}

        {view.kind === 'paused' && (
          <Button variant="secondary" className="plover-expanded__resume">▶ Resume</Button>
        )}
        {view.kind === 'not-sure' && (
          <div className="plover-expanded__verify">
            <span>Still working on this?</span>
            <Button variant="primary">Yes</Button>
            <Button variant="secondary">Pause</Button>
          </div>
        )}
      </motion.section>
    );
  }
  ```

- [ ] CSS: card uses `var(--plover-surface)` with
  `backdrop-filter: blur(28px)`, radius `var(--plover-radius-lg)`,
  shadow `var(--plover-shadow-card)`. Segments: 6 boxes with `gap: 6px`,
  radius `3px`, filled boxes use `var(--plover-text)` low-opacity;
  past-progress boxes use `var(--plover-mint)` when `kind === 'done'`.

- [ ] Commit `feat(companion): expanded card view`.

### Task 03.6 — `Companion.tsx` (root)

Owns the `expanded` boolean and calls `window.api.companion.resize` when
it changes, so the BrowserWindow grows / shrinks in step.

- [ ] Create `Companion.tsx`:

  ```tsx
  import { useEffect, useRef, useState } from 'react';
  import { AnimatePresence } from '../lib/motion';
  import { Collapsed } from './Collapsed';
  import { Expanded } from './Expanded';
  import { useCompanionState } from './useCompanionState';

  export function Companion() {
    const view = useCompanionState();
    const [expanded, setExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => {
        const h = containerRef.current!.getBoundingClientRect().height;
        window.api.companion.resize(Math.ceil(h)).catch(console.error);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [expanded]);

    return (
      <div ref={containerRef} className="plover-companion-root">
        <AnimatePresence mode="wait">
          {expanded ? (
            <Expanded key="exp" view={view} onCollapse={() => setExpanded(false)} />
          ) : (
            <Collapsed key="col" view={view} onExpand={() => setExpanded(true)} />
          )}
        </AnimatePresence>
      </div>
    );
  }
  ```

- [ ] Create `companion/main.tsx` mirroring `renderer/main.tsx` boot,
  but rendering `<Companion />` into `#root` and loading the same
  fontsource imports from PR-01.

- [ ] Create `companion/index.html` modelled on the existing
  `renderer/index.html`.

- [ ] Test (`Companion.test.tsx`) renders the component, asserts the
  collapsed pill is shown by default, clicking it switches to expanded,
  and the resize IPC mock is called.

- [ ] Commit `feat(companion): root component with expand/collapse`.

### Task 03.7 — State-transition coverage

Each transition is a single `companion:state` event followed by a
target visual. Validate with rendering tests:

- [ ] In `Companion.test.tsx`, dispatch `companion:state` events for
  each of the four kinds and assert the rendered output:

  - `observing` → mint pulsing dot, mint progress fill.
  - `paused` → neutral dot, faded fill, "Resume" button visible in
    expanded view.
  - `done` → mint check icon, 100% bar, no `now` label.
  - `not-sure` → dashed dot, "Still working on this?" verify row.

- [ ] Visually confirm with `pnpm dev` — open the companion via a
  temporary dev hotkey (wire in `app/src/main/index.ts`), cycle through
  states using a small debug menu (gate behind `process.env.NODE_ENV !== 'production'`).

- [ ] Commit `test(companion): cover the four state transitions`.

### Task 03.8 — Verification

- [ ] From repo root:

  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  pnpm --filter ./app run test:coverage
  pnpm build
  ```

- [ ] `pnpm dev` and confirm: the companion pill appears top-right,
  click expands it to the card, click "···" collapses back. Drag
  works (frameless window movement via CSS `-webkit-app-region: drag`).

- [ ] Open PR `feat(overlay): companion pill, expanded card, state transitions`.

## Risks / footguns

- **Two windows, one preload.** The companion shares the existing
  `preload/index.cjs` so `window.api` is identical in both. If preload
  isn't externalized correctly, the companion will silently fail
  (lessons-learned `2026-05-31`). Validate preload path is the same
  string used by the main window.
- **`-webkit-app-region: drag`** on the pill's outer container will
  swallow clicks. Set `drag` on a sliver header strip only, leave the
  pill body interactive.
- **`prefers-reduced-motion`** — the pulsing dot must be gated behind
  `useReducedMotion()`. When true, render a static dot.
- **Frameless + transparent on Linux/Windows** — out of scope for Phase
  1 (macOS-only), but if anyone runs `pnpm dev` on Linux the vibrancy
  call will no-op; the window will still render.

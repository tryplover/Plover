# PR-04 · Setup flow redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`.

**Goal:** Replace the existing `QuickAdd.tsx` overlay with the moodboard's
three-step flow: **Name → Breakdown → Connect**. The existing decompose +
commit IPC contracts (`window.api.proposeGoal`, `window.api.commitGoal`)
are unchanged — only presentation changes.

**Architecture:** The setup overlay is still its own `BrowserWindow`
(distinct from the companion in PR-03). The flow is one React component
with a step machine of four values (`name`, `breakdown`, `connect`,
`committed`), driving an `AnimatePresence` that slides each step in. Both
the **overlay** (compact) and **window** (roomier, app-like) variants from
pages 3–4 of the moodboard are produced from a single tree — a
`variant: 'overlay' | 'window'` prop swaps a few size tokens, nothing
else.

**Tech stack:** React, framer-motion, the PR-02 component library.

## Scope notes

- **Step 3 ("Connect window")** is a forward-looking surface — actual
  window-picking belongs to Phase 2 monitoring. In this PR the step
  renders the three example apps from the moodboard as **non-functional
  cards plus a "Skip for now" link** that records `linked_window: null`
  on the resulting goal. The "Deeper integrations — coming soon" row is
  a static label.
- Drag-to-reorder steps in the breakdown step is **deferred**. Render
  the drag handles (`::` glyph) but don't wire DnD. A follow-up PR
  adds `dnd-kit`.

## Global constraints

- Existing IPC contracts `proposeGoal(goalText): Promise<ProposedPlan>`
  and `commitGoal(plan): Promise<void>` MUST NOT change.
- The keyboard shortcut that opens the overlay (global hotkey) stays
  identical.
- `Escape` closes the overlay from any step, mirroring the current
  behaviour in `Overlay.tsx`.

---

## Files

- Delete: nothing yet — `Overlay.tsx` and `QuickAdd.tsx` are rewritten
  in place to avoid orphaned imports during the diff.
- Modify: `app/src/renderer/overlay/Overlay.tsx` — becomes the wrapper
  that picks `variant`. Reads `?variant=window` from the URL when
  Electron opens the window-style setup.
- Replace: `app/src/renderer/overlay/QuickAdd.tsx` → `SetupFlow.tsx`
  (new file). Keep `QuickAdd.tsx` only if other code imports it; PR
  ends by removing it once references are clear.
- Create: `app/src/renderer/overlay/SetupFlow.tsx`
- Create: `app/src/renderer/overlay/steps/StepName.tsx`
- Create: `app/src/renderer/overlay/steps/StepBreakdown.tsx`
- Create: `app/src/renderer/overlay/steps/StepConnect.tsx`
- Create: `app/src/renderer/overlay/steps/Stepper.tsx` — the bottom
  step indicator (`1 · Name` etc.)
- Create: `app/src/renderer/overlay/SetupFlow.css`
- Modify: `app/src/main/windows/overlay.ts` (or wherever the overlay
  factory lives) — add `variant: 'overlay' | 'window'` and pass it
  via URL param.
- Update tests:
  - Replace `app/tests/renderer/overlay/QuickAdd.test.tsx` with
    `SetupFlow.test.tsx`.
  - Add per-step tests: `StepName.test.tsx`, `StepBreakdown.test.tsx`,
    `StepConnect.test.tsx`.

## Interfaces

```ts
type Variant = 'overlay' | 'window';

export interface SetupFlowProps {
  variant?: Variant; // default 'overlay'
}

// Internal step machine
type Step = 'name' | 'breakdown' | 'connect' | 'committed';

interface DraftGoal {
  text: string;
  frequency: 'one-off' | 'daily' | 'weekly';
}
```

## Tasks

### Task 04.1 — Restructure `Overlay.tsx`

- [ ] Rewrite `Overlay.tsx` so it:
  - Reads `?variant=window` from `window.location.search`.
  - Renders a `SetupFlow` with that variant.
  - Keeps the existing `ResizeObserver` → `window.api.resizeOverlay`
    wiring (untouched from the current implementation).
  - Keeps the `Escape` key handler.
  - **Drops the glassy outer chrome** when `variant === 'window'` —
    in window mode the chrome belongs to the OS title bar.

  ```tsx
  export function Overlay() {
    const variant = new URLSearchParams(window.location.search).get('variant') === 'window' ? 'window' : 'overlay';
    return <SetupFlow variant={variant} />;
  }
  ```

- [ ] Commit `refactor(overlay): route variant via URL param`.

### Task 04.2 — `Stepper` indicator

Three dots + label at the bottom (`1 · Name`, `2 · Breakdown`,
`3 · Connect`).

- [ ] Create `Stepper.tsx`:

  ```tsx
  import './Stepper.css';
  export function Stepper({ current }: { current: 1 | 2 | 3 }) {
    return (
      <ol className="plover-stepper">
        {(['Name', 'Breakdown', 'Connect'] as const).map((label, i) => {
          const idx = (i + 1) as 1 | 2 | 3;
          return (
            <li key={label} data-current={idx === current ? 'true' : 'false'}>
              <span className="plover-stepper__num">{idx}</span>
              <span className="plover-stepper__label">{label}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  ```

- [ ] CSS — non-current items get `var(--plover-text-dim)`; current
  is `var(--plover-text)`.

- [ ] Commit `feat(overlay): add Stepper`.

### Task 04.3 — `StepName`

Text input + One-off / Daily / Weekly chips + primary "Break into
steps →" button.

- [ ] Create `steps/StepName.tsx`:

  ```tsx
  import { useEffect, useRef } from 'react';
  import { Button } from '../../components/Button';
  import { Chip } from '../../components/Chip';
  import { StatusIndicator } from '../../components/StatusIndicator';

  interface Props {
    value: { text: string; frequency: 'one-off' | 'daily' | 'weekly' };
    onChange: (next: Props['value']) => void;
    onNext: () => void;
    variant: 'overlay' | 'window';
  }

  export function StepName({ value, onChange, onNext, variant }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => inputRef.current?.focus(), []);

    return (
      <form
        className={`plover-step-name plover-step-name--${variant}`}
        onSubmit={(e) => { e.preventDefault(); if (value.text.trim()) onNext(); }}
      >
        <StatusIndicator kind="observing" label="new task" />
        <h2>What are you working on?</h2>
        <input
          ref={inputRef}
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="Finish the methods section of my thesis"
        />
        {variant === 'window' && <p className="plover-step-name__how">How often is this?</p>}
        <div className="plover-step-name__chips">
          {(['one-off', 'daily', 'weekly'] as const).map((f) => (
            <Chip key={f} selected={value.frequency === f} onClick={() => onChange({ ...value, frequency: f })}>
              {f === 'one-off' ? 'One-off' : f === 'daily' ? 'Daily' : 'Weekly'}
            </Chip>
          ))}
        </div>
        <div className="plover-step-name__cta">
          <Button variant="primary" type="submit" disabled={!value.text.trim()}>
            Break into steps →
          </Button>
        </div>
      </form>
    );
  }
  ```

- [ ] CSS — overlay variant: input takes full width, sans heading.
  Window variant: heading uses `var(--plover-font-serif)` at `28px`,
  input is taller, vertical rhythm is roomier (`32px` gaps vs `16px`).

- [ ] Test verifies pressing Enter advances when text non-empty,
  selecting a chip updates `frequency`, the primary button is disabled
  when text is empty.

- [ ] Commit `feat(overlay): step 1 — name`.

### Task 04.4 — `StepBreakdown`

Renders the proposed plan as `StepRow` instances, with `+ Add a step`
and `Back` / `Looks right →`. Calls `window.api.proposeGoal` on mount.

- [ ] Create `steps/StepBreakdown.tsx`:

  ```tsx
  import { useEffect, useState } from 'react';
  import { StatusIndicator } from '../../components/StatusIndicator';
  import { StepRow } from '../../components/StepRow';
  import { Button } from '../../components/Button';
  import type { ProposedPlan } from '../../../preload';

  interface Props {
    draft: { text: string; frequency: 'one-off' | 'daily' | 'weekly' };
    onBack: () => void;
    onNext: (plan: ProposedPlan) => void;
    variant: 'overlay' | 'window';
  }

  export function StepBreakdown({ draft, onBack, onNext, variant }: Props) {
    const [plan, setPlan] = useState<ProposedPlan | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const result = await window.api.proposeGoal(draft.text);
          if (!cancelled) setPlan(result);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [draft.text]);

    if (loading) return <p className="plover-step-breakdown__loading">Asking Gemini…</p>;
    if (error || !plan) return <p className="plover-step-breakdown__error">{error ?? 'No plan'}</p>;

    const renameStep = (idx: number, title: string) => {
      setPlan((p) => {
        if (!p) return p;
        const next = [...p.subtasks];
        const item = next[idx];
        if (item) next[idx] = { ...item, title };
        return { ...p, subtasks: next };
      });
    };

    const addStep = () => {
      setPlan((p) => p ? { ...p, subtasks: [...p.subtasks, { title: 'New step', estimate_minutes: 30 }] } : p);
    };

    return (
      <section className={`plover-step-breakdown plover-step-breakdown--${variant}`}>
        <StatusIndicator kind="observing" label={`Gemini suggested ${plan.subtasks.length} steps`} />
        <h2>{plan.goal.title}</h2>
        <ol className="plover-step-breakdown__list">
          {plan.subtasks.map((s, i) => (
            <li key={i}>
              <StepRow
                index={i + 1}
                label={s.title}
                state="pending"
                trailing={<span className="plover-drag-handle" aria-hidden>⋮⋮</span>}
              />
            </li>
          ))}
        </ol>
        <button className="plover-step-breakdown__add" onClick={addStep}>+ Add a step</button>
        <footer>
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button variant="primary" onClick={() => onNext(plan)}>Looks right →</Button>
        </footer>
      </section>
    );
  }
  ```

  Note: drag-to-reorder is deferred — handle is purely visual.

- [ ] Inline editing of the step title is allowed in the existing
  `QuickAdd.tsx`. Preserve it via a `contentEditable={true}` span or
  by swapping the label to a tiny input when clicked. Choose the
  simpler approach (contentEditable) since this matches the existing UX.

- [ ] Test mocks `window.api.proposeGoal` (via `vi.hoisted`), renders
  the component, awaits the resolved plan, asserts the steps render,
  asserts `+ Add a step` appends an entry.

- [ ] Commit `feat(overlay): step 2 — breakdown`.

### Task 04.5 — `StepConnect`

The window picker. Phase-1 placeholder: render three example apps
from the moodboard as `AppRow` instances, none of them functionally
select a window. Calls `window.api.commitGoal` and then collapses
the overlay.

- [ ] Create `steps/StepConnect.tsx`:

  ```tsx
  import { useState } from 'react';
  import { StatusIndicator } from '../../components/StatusIndicator';
  import { AppRow } from '../../components/AppRow';
  import { Button } from '../../components/Button';
  import type { ProposedPlan } from '../../../preload';

  const EXAMPLES = [
    { id: 'g', initial: 'G', title: 'Google Docs — Thesis draft', subtitle: 'Active now · Chrome' },
    { id: 'n', initial: 'N', title: 'Notion — Research notes', subtitle: 'Open · Notion' },
    { id: 'p', initial: 'P', title: 'Preview — sources.pdf', subtitle: 'Open · Preview' },
  ] as const;

  interface Props {
    plan: ProposedPlan;
    onBack: () => void;
    onCommitted: () => void;
    variant: 'overlay' | 'window';
  }

  export function StepConnect({ plan, onBack, onCommitted, variant }: Props) {
    const [selected, setSelected] = useState<string | null>(EXAMPLES[0].id);
    const [busy, setBusy] = useState(false);

    const start = async () => {
      setBusy(true);
      try {
        await window.api.commitGoal(plan);
        onCommitted();
      } finally {
        setBusy(false);
      }
    };

    return (
      <section className={`plover-step-connect plover-step-connect--${variant}`}>
        <StatusIndicator kind="observing" label="last step" />
        <h2>Which window should I watch?</h2>
        <p className="plover-step-connect__consent">
          I only ever look at the one window you choose — never the rest of your screen.
        </p>
        <ul>
          {EXAMPLES.map((app) => (
            <li key={app.id}>
              <AppRow
                initial={app.initial}
                title={app.title}
                subtitle={app.subtitle}
                selected={selected === app.id}
                onWatch={() => setSelected(app.id)}
              />
            </li>
          ))}
        </ul>
        <p className="plover-step-connect__coming-soon">
          Deeper integrations — Docs, VS Code, Notion <span>coming soon</span>
        </p>
        <footer>
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button variant="primary" onClick={start} disabled={busy}>
            {busy ? 'Saving…' : 'Start tracking →'}
          </Button>
        </footer>
      </section>
    );
  }
  ```

- [ ] CSS — `consent` text uses `var(--plover-text-muted)` and a
  smaller size. `coming-soon` row is a single line with the label
  on the right styled like a chip.

- [ ] Test mocks `commitGoal`, clicks "Start tracking →", asserts
  `onCommitted` is called and the IPC mock was invoked with the
  given plan.

- [ ] Commit `feat(overlay): step 3 — connect`.

### Task 04.6 — `SetupFlow` machine + transitions

Owns step state, transitions via `AnimatePresence` (slide-from-right
on next, fade on commit).

- [ ] Create `SetupFlow.tsx`:

  ```tsx
  import { useState } from 'react';
  import { AnimatePresence, motion, ploverDuration, ploverEasing } from '../lib/motion';
  import { Stepper } from './steps/Stepper';
  import { StepName } from './steps/StepName';
  import { StepBreakdown } from './steps/StepBreakdown';
  import { StepConnect } from './steps/StepConnect';
  import type { ProposedPlan } from '../../preload';
  import './SetupFlow.css';

  type Step = 'name' | 'breakdown' | 'connect' | 'committed';

  export function SetupFlow({ variant = 'overlay' as const }: { variant?: 'overlay' | 'window' }) {
    const [step, setStep] = useState<Step>('name');
    const [draft, setDraft] = useState<{ text: string; frequency: 'one-off' | 'daily' | 'weekly' }>({ text: '', frequency: 'one-off' });
    const [plan, setPlan] = useState<ProposedPlan | null>(null);

    const close = () => window.api.closeOverlay().catch(console.error);

    return (
      <div className={`plover-setup plover-setup--${variant}`}>
        {variant === 'window' && <div className="plover-setup__chrome">Plover</div>}
        <AnimatePresence mode="wait">
          {step === 'name' && (
            <motion.div key="name" {...slide()}>
              <StepName value={draft} onChange={setDraft} onNext={() => setStep('breakdown')} variant={variant} />
            </motion.div>
          )}
          {step === 'breakdown' && (
            <motion.div key="breakdown" {...slide()}>
              <StepBreakdown
                draft={draft}
                variant={variant}
                onBack={() => setStep('name')}
                onNext={(p) => { setPlan(p); setStep('connect'); }}
              />
            </motion.div>
          )}
          {step === 'connect' && plan && (
            <motion.div key="connect" {...slide()}>
              <StepConnect
                plan={plan}
                variant={variant}
                onBack={() => setStep('breakdown')}
                onCommitted={() => { setStep('committed'); setTimeout(close, 800); }}
              />
            </motion.div>
          )}
          {step === 'committed' && (
            <motion.div key="committed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p>Tracking started.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <Stepper current={step === 'name' ? 1 : step === 'breakdown' ? 2 : 3} />
      </div>
    );
  }

  function slide() {
    return {
      initial: { opacity: 0, x: 18 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -18 },
      transition: { duration: ploverDuration.normal, ease: ploverEasing.soft },
    };
  }
  ```

- [ ] CSS — `.plover-setup--overlay` keeps the existing translucent
  card chrome (radius `var(--plover-radius-lg)`, blur, shadow). The
  `--window` variant drops blur, uses `var(--plover-surface)` solid,
  pads `48px`, and renders `__chrome` (a fake traffic-light row) at
  the top.

- [ ] Test the state machine end-to-end with mocked IPC: name → next →
  breakdown loads → next → connect → commit. Assert each transition.

- [ ] Commit `feat(overlay): three-step SetupFlow with transitions`.

### Task 04.7 — Main process: window-variant overlay

Currently the overlay only has one variant. Add a way to open it in
window mode. Lowest-touch approach: a separate IPC handler
`overlay:openWindowVariant` that opens the same overlay HTML with
`?variant=window` and a roomier window size + standard chrome.

- [ ] Modify the overlay factory in `app/src/main/windows/overlay.ts`
  (or wherever it lives — search for `BrowserWindow` + overlay):

  ```ts
  export function createOverlayWindow(variant: 'overlay' | 'window' = 'overlay') {
    const isWindow = variant === 'window';
    const win = new BrowserWindow({
      width: isWindow ? 720 : 420,
      height: isWindow ? 640 : 200,
      frame: isWindow,
      transparent: !isWindow,
      titleBarStyle: isWindow ? 'hiddenInset' : undefined,
      vibrancy: isWindow ? undefined : 'under-window',
      // ...other existing options
    });
    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/index.html?variant=${variant}`);
    } else {
      void win.loadFile(join(import.meta.dirname, '../renderer/index.html'), { search: `variant=${variant}` });
    }
    return win;
  }
  ```

- [ ] Add the IPC handler in `ipc.ts`:

  ```ts
  ipcMain.handle('overlay:openWindow', () => createOverlayWindow('window').show());
  ```

  And expose it in preload as `window.api.openSetupWindow()`.

- [ ] In `Settings.tsx` (PR-05 will polish this), add a temporary
  "Open setup window" button for testing — remove or relocate in
  PR-05.

- [ ] Commit `feat(main): overlay variant factory`.

### Task 04.8 — Verification

- [ ] From repo root:

  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  pnpm --filter ./app run test:coverage
  ```

- [ ] `pnpm dev`. Hit the overlay hotkey — the overlay opens in compact
  variant, all three steps slide in correctly, "Start tracking →"
  closes the overlay and the goal appears in the main window's Today
  view. Then open the setup window variant via the temporary button —
  same flow renders in the roomier centered card.

- [ ] Open PR `feat(overlay): three-step setup flow (overlay + window variants)`.

## Risks / footguns

- **`proposeGoal` race condition** — `StepBreakdown` cancels on
  unmount. If the user goes Back → Next quickly, both effect runs
  must be cancellable. The `cancelled` flag covers it.
- **electron-vite multi-entry build** — when PR-03 already added
  `companion.html`, PR-04 doesn't need rollup changes, just URL
  param routing.
- **`contentEditable` and `noUncheckedIndexedAccess`** — when reading
  the edited text, use the destructure pattern (CLAUDE.md
  lessons-learned `2026-06-12`).
- **Fallback Gemini model loop** (lessons-learned `2026-05-31`) is on
  the server side; this PR doesn't touch it. The overlay simply
  surfaces whatever error string is returned.

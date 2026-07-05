# PR-02 · Component library

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`.

**Goal:** Build the six reusable primitives shown on page 7 of the moodboard:
`StatusIndicator`, `ProgressLine`, `Button`, `StepRow`, `AppRow`, `Chip`.
Each has a small surface area, full variants, and a unit test. No
feature integration in this PR — primitives only.

**Architecture:** Pure React function components under
`app/src/renderer/components/`. No state managed inside the components
except for hover/focus styling; all data flows in via props. CSS modules
are avoided — components ship a sibling `.css` file imported once at the
component file's top. Animations come from `lib/motion.ts` (added in PR-01).

**Tech stack:** React 18, framer-motion, plain CSS.

## Global constraints

- One file per component. No barrel-exporting from a single `index.ts`
  until a real consumer needs it.
- Components must be controllable from the outside — no internal data
  fetching, no `useEffect` that calls the IPC API.
- Every component has a `data-testid` derived from its variant, so
  Vitest queries by role + testid rather than text.
- All copy strings (`observing`, `paused`, `Done`, `not sure`, `Watch`,
  `now`) are passed by callers — components hold none of them.

---

## Files

- Create: `app/src/renderer/components/StatusIndicator.tsx` + `.css`
- Create: `app/src/renderer/components/ProgressLine.tsx` + `.css`
- Create: `app/src/renderer/components/Button.tsx` + `.css`
- Create: `app/src/renderer/components/StepRow.tsx` + `.css`
- Create: `app/src/renderer/components/AppRow.tsx` + `.css`
- Create: `app/src/renderer/components/Chip.tsx` + `.css`
- Create: `app/tests/renderer/components/<Component>.test.tsx` for each
- Create: `app/src/renderer/dev/ComponentGallery.tsx` — a lightweight
  gallery page reachable via `?gallery=1` in the dev URL. Pure visual
  smoke-test surface; excluded from production bundle via Vite's
  `import.meta.env.DEV` guard.

## Interfaces (consumed by PR-03 / PR-04 / PR-05)

```ts
// StatusIndicator
export type StatusKind = 'observing' | 'paused' | 'done' | 'not-sure';
export interface StatusIndicatorProps {
  kind: StatusKind;
  label: string;
}

// ProgressLine
export interface ProgressLineProps {
  /** 0–1; values outside that range clamp. */
  value: number;
  /** When true, the fill animates from previous value with motion tokens. */
  animate?: boolean;
  /** Visual treatment: 'solid' is the cream bar; 'mint' is the Done bar. */
  tone?: 'solid' | 'mint';
}

// Button
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
}

// StepRow
export interface StepRowProps {
  index?: number; // when shown in setup-breakdown form
  label: string;
  state: 'pending' | 'current' | 'done';
  trailing?: React.ReactNode; // e.g. <span>now</span> or a drag handle
}

// AppRow
export interface AppRowProps {
  initial: string; // single-letter monogram, e.g. 'G' / 'N' / 'P'
  title: string;
  subtitle: string;
  selected?: boolean;
  onWatch?: () => void;
}

// Chip
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}
```

## Tasks

### Task 02.1 — `StatusIndicator`

The pill in `observing · Draft — methods · 65%`. Different `kind`s
change the dot's color/animation and the label color.

- [ ] Create `StatusIndicator.tsx`:

  ```tsx
  import { motion } from '../lib/motion';
  import './StatusIndicator.css';

  export type StatusKind = 'observing' | 'paused' | 'done' | 'not-sure';

  export interface StatusIndicatorProps {
    kind: StatusKind;
    label: string;
  }

  export function StatusIndicator({ kind, label }: StatusIndicatorProps) {
    return (
      <span className="plover-status" data-kind={kind} data-testid={`status-${kind}`}>
        <span className="plover-status__dot" aria-hidden>
          {kind === 'observing' && (
            <motion.span
              className="plover-status__pulse"
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </span>
        <span className="plover-status__label">{label}</span>
      </span>
    );
  }
  ```

- [ ] Sibling CSS uses `data-kind` to color the dot: mint for
  `observing` and `done`, neutral for `paused`, dashed-ring for
  `not-sure` (use a `::before` with `border: 1px dashed`). Label color is
  `--plover-mint` for `observing` and `done`, otherwise
  `--plover-text-muted`.

- [ ] Test (`StatusIndicator.test.tsx`):

  ```tsx
  it('renders each kind with the right testid + label', () => {
    const kinds: StatusKind[] = ['observing', 'paused', 'done', 'not-sure'];
    for (const k of kinds) {
      const { getByTestId, unmount } = render(<StatusIndicator kind={k} label={k} />);
      expect(getByTestId(`status-${k}`)).toHaveTextContent(k);
      unmount();
    }
  });
  ```

- [ ] Commit:

  ```bash
  git add app/src/renderer/components/StatusIndicator.* app/tests/renderer/components/StatusIndicator.test.tsx
  git commit -m "feat(components): add StatusIndicator"
  ```

### Task 02.2 — `ProgressLine`

Page 7 shows four variants in the gallery: 50% solid, 50% lighter,
70% mint, 50% lighter again. The component just needs `value`, `tone`,
and `animate`.

- [ ] Create `ProgressLine.tsx`:

  ```tsx
  import { motion, ploverDuration, ploverEasing } from '../lib/motion';
  import './ProgressLine.css';

  export interface ProgressLineProps {
    value: number;
    animate?: boolean;
    tone?: 'solid' | 'mint';
  }

  export function ProgressLine({ value, animate = true, tone = 'solid' }: ProgressLineProps) {
    const clamped = Math.max(0, Math.min(1, value));
    return (
      <div className="plover-progress" data-tone={tone}>
        <motion.div
          className="plover-progress__fill"
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: ploverDuration.slow, ease: ploverEasing.soft }}
        />
      </div>
    );
  }
  ```

- [ ] CSS uses `--plover-mint` for `data-tone="mint"` and
  `--plover-text` (low opacity) for solid. Track is
  `rgba(255,255,255,0.08)`. Height `6px`, radius `999px`.

- [ ] Test asserts clamping (`value={1.5}` ends at `100%`,
  `value={-0.2}` at `0%`).

- [ ] Commit `feat(components): add ProgressLine`.

### Task 02.3 — `Button`

Two variants: primary (cream background, dark text) and secondary
(near-black background, cream text). Both have a subtle press scale.

- [ ] Create `Button.tsx`:

  ```tsx
  import { motion } from '../lib/motion';
  import './Button.css';

  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant: 'primary' | 'secondary';
  }

  export function Button({ variant, className = '', children, ...rest }: ButtonProps) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        className={`plover-btn plover-btn--${variant} ${className}`}
        {...rest}
      >
        {children}
      </motion.button>
    );
  }
  ```

- [ ] CSS — primary uses `--plover-button-primary` /
  `--plover-button-primary-fg`, radius `var(--plover-radius-sm)`, font
  weight 500, padding `10px 18px`. Secondary uses
  `--plover-button-secondary` and the cream text.

- [ ] Test asserts click invokes `onClick`, primary has class
  `plover-btn--primary`, secondary has class `plover-btn--secondary`.

- [ ] Commit `feat(components): add Button`.

### Task 02.4 — `StepRow`

Page 7 shows four step states: completed (strikethrough check),
current (mint ring + label + `now`), pending (faded number), and the
breakdown variant (numbered with drag dots on the right).

- [ ] Create `StepRow.tsx`:

  ```tsx
  import { motion, ploverDuration, ploverEasing } from '../lib/motion';
  import './StepRow.css';

  export interface StepRowProps {
    index?: number;
    label: string;
    state: 'pending' | 'current' | 'done';
    trailing?: React.ReactNode;
  }

  export function StepRow({ index, label, state, trailing }: StepRowProps) {
    return (
      <motion.div
        className="plover-step"
        data-state={state}
        layout
        transition={{ duration: ploverDuration.normal, ease: ploverEasing.soft }}
      >
        <span className="plover-step__bullet" aria-hidden>
          {state === 'done' ? '✓' : index !== undefined ? index : null}
        </span>
        <span className="plover-step__label">{label}</span>
        {trailing && <span className="plover-step__trailing">{trailing}</span>}
      </motion.div>
    );
  }
  ```

- [ ] CSS — `data-state="done"` strikes through the label and
  desaturates. `current` adds a mint ring on `.plover-step__bullet` and
  mints the label. `pending` keeps a faint number circle.

- [ ] Test renders all three states and asserts the strike-through is
  present on `done` only.

- [ ] Commit `feat(components): add StepRow`.

### Task 02.5 — `AppRow`

The window picker row on page 3. Two states: selected (mint check on the
right) and non-selected (a `Watch` button on the right).

- [ ] Create `AppRow.tsx`:

  ```tsx
  import { Button } from './Button';
  import './AppRow.css';

  export interface AppRowProps {
    initial: string;
    title: string;
    subtitle: string;
    selected?: boolean;
    onWatch?: () => void;
  }

  export function AppRow({ initial, title, subtitle, selected, onWatch }: AppRowProps) {
    return (
      <div className="plover-approw" data-selected={selected ? 'true' : 'false'}>
        <span className="plover-approw__avatar" aria-hidden>{initial}</span>
        <span className="plover-approw__text">
          <span className="plover-approw__title">{title}</span>
          <span className="plover-approw__subtitle">{subtitle}</span>
        </span>
        {selected ? (
          <span className="plover-approw__check" aria-label="watching">✓</span>
        ) : (
          <Button variant="secondary" onClick={onWatch}>Watch</Button>
        )}
      </div>
    );
  }
  ```

- [ ] CSS — avatar is a `28px` square with `--plover-radius-sm`,
  monogram type. Selected variant gets a mint hairline border and a
  mint check on the right. Padding `12px 14px`, radius
  `var(--plover-radius-md)`.

- [ ] Test asserts clicking `Watch` calls `onWatch`; when `selected`,
  the `Watch` button is not rendered.

- [ ] Commit `feat(components): add AppRow`.

### Task 02.6 — `Chip`

Frequency picker on page 3 / page 4: `One-off · Daily · Weekly`. Selected
gets a thin mint border + cream text; unselected stays neutral.

- [ ] Create `Chip.tsx`:

  ```tsx
  import './Chip.css';

  export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    selected?: boolean;
  }

  export function Chip({ selected, className = '', children, ...rest }: ChipProps) {
    return (
      <button
        className={`plover-chip ${className}`}
        data-selected={selected ? 'true' : 'false'}
        {...rest}
      >
        {children}
      </button>
    );
  }
  ```

- [ ] CSS — radius `999px`, padding `6px 12px`, font weight 500.
  Selected: `1px solid var(--plover-mint)`, background
  `var(--plover-mint-soft)`. Unselected: background
  `var(--plover-surface-raised)`, no border.

- [ ] Test asserts `data-selected` toggles and click fires `onClick`.

- [ ] Commit `feat(components): add Chip`.

### Task 02.7 — Dev gallery page

Visual smoke-test surface. Not shipped in production.

- [ ] Create `app/src/renderer/dev/ComponentGallery.tsx` that renders
  each component once in every variant inside a dark canvas. Reach
  it via `?gallery=1` in the URL — add a tiny branch in `main.tsx`:

  ```tsx
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('gallery') === '1') {
    const { ComponentGallery } = await import('./dev/ComponentGallery');
    createRoot(document.getElementById('root')!).render(<ComponentGallery />);
  } else {
    createRoot(document.getElementById('root')!).render(<App />);
  }
  ```

  (Adapt to existing `main.tsx` structure; keep prod path identical.)

- [ ] Open `http://localhost:5173/?gallery=1` under `pnpm dev` and
  eyeball every component against page 7 of the moodboard.

- [ ] Commit `feat(renderer): add component gallery for redesign smoke tests`.

### Task 02.8 — Verification

- [ ] From repo root:

  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  pnpm --filter ./app run test:coverage
  ```

  All green; coverage on `components/` directory is informational only
  (Phase 1 gate is on `planner` + `store`).

- [ ] Open PR `feat(components): add primitives for redesign`.

## Risks / footguns

- **`noUncheckedIndexedAccess` in tests.** The test files use the
  destructure-and-optional-chain pattern from CLAUDE.md lessons-learned
  `2026-06-12`. Do not use `!`.
- **Vitest hoisting (`vi.mock`).** None of these components import IPC,
  so no mocks needed. If a future test needs `window.api`, mock via
  `vi.hoisted` (lessons-learned `2026-05-24`).
- **CSS pollution.** Component CSS files are global. Prefix every
  selector with `.plover-<component>` so PR-03 / PR-04 / PR-05 markup
  doesn't accidentally inherit.

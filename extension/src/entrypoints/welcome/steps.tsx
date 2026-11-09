import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";
import { sendCommand } from "@/shared/messages";
import { Buddy } from "@/ui/components/Buddy";
import { SignIn } from "@/ui/components/SignIn";

function Heading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className="plover-heading welcome-heading">
      {children}
    </h1>
  );
}

export function useSiteAccess() {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void browser.permissions.contains({ origins: [ALL_SITES] }).then((ok) => {
        if (alive) setGranted(ok);
      });
    };
    refresh();
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      alive = false;
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, []);

  return granted;
}

export function HelloStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <p className="plover-eyebrow">Welcome</p>
      <Heading>Hi, I&apos;m Plover.</Heading>
      <p className="welcome-body">
        I&apos;m a small work buddy. I help you start, one step at a time.
      </p>
      <button type="button" className="plover-btn-brand" onClick={onNext}>
        Let&apos;s get set up
      </button>
    </>
  );
}

export function SignInStep({
  needsSignIn,
  onNext,
}: {
  needsSignIn: boolean;
  onNext: () => void;
}) {
  const [arrivedSignedOut] = useState(needsSignIn);

  useEffect(() => {
    if (!arrivedSignedOut || needsSignIn) return;
    const id = setTimeout(onNext, 600);
    return () => clearTimeout(id);
  }, [arrivedSignedOut, needsSignIn, onNext]);

  return (
    <>
      <Heading>First, let&apos;s sign you in</Heading>
      <p className="welcome-body">
        Sign in so I can save your tasks and suggest steps. I&apos;ll move on by
        myself once you&apos;re in.
      </p>
      {needsSignIn ? (
        <SignIn />
      ) : (
        <>
          <p className="welcome-done">
            <span aria-hidden="true" className="welcome-tick">
              ✓
            </span>
            You&apos;re signed in.
          </p>
          <button type="button" className="plover-btn-brand" onClick={onNext}>
            Continue
          </button>
        </>
      )}
    </>
  );
}

export function SiteAccessStep({ onNext }: { onNext: () => void }) {
  const granted = useSiteAccess();
  const [declined, setDeclined] = useState(false);

  return (
    <>
      <Heading>I&apos;ll sit in the corner of your pages</Heading>
      <p className="welcome-body">
        I only draw myself. I never read the page or your history.
      </p>
      <div className="welcome-browser" aria-hidden="true">
        <div className="welcome-browser__bar">
          <span className="welcome-browser__dot" />
          <span className="welcome-browser__dot" />
          <span className="welcome-browser__dot" />
          <span className="welcome-browser__address" />
        </div>
        <div className="welcome-browser__page">
          <span className="welcome-browser__line" />
          <span className="welcome-browser__line" />
          <span className="welcome-browser__line welcome-browser__line--short" />
        </div>
        {granted && (
          <div className="welcome-browser__buddy">
            <Buddy state="working" />
          </div>
        )}
      </div>
      {granted ? (
        <button type="button" className="plover-btn-brand" onClick={onNext}>
          Continue
        </button>
      ) : (
        <>
          <p className="welcome-note">
            Chrome will say I can &ldquo;read and change&rdquo; your sites.
            That&apos;s its standard warning for anything that draws on a page.
          </p>
          <button
            type="button"
            className="plover-btn-brand"
            onClick={() =>
              void browser.permissions
                .request({ origins: [ALL_SITES] })
                .then((ok) => setDeclined(!ok))
            }
          >
            Put me on your pages
          </button>
          <button type="button" className="plover-btn-text" onClick={onNext}>
            Not now
          </button>
          {declined && (
            <p role="status" className="welcome-note">
              No problem. You can add me one site at a time from my popup.
            </p>
          )}
        </>
      )}
    </>
  );
}

const HOW_IT_WORKS = [
  {
    title: "You tell me what's on your plate",
    line: "Big or fuzzy is fine. I'll break it into small steps, and you can change any of them.",
  },
  {
    title: "We focus together",
    line: "I'll start a 25-minute timer, block the sites you pick, and stay quiet in my corner.",
  },
  {
    title: "I'll check in",
    line: "When the timer ends, I'll ask what you got done. Then we both take a break.",
  },
];

export function HowStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <Heading>Here&apos;s how I&apos;ll help</Heading>
      <p className="welcome-body">
        We&apos;ll take it one small step at a time, together.
      </p>
      <ol className="welcome-rows">
        {HOW_IT_WORKS.map((row, i) => (
          <li
            key={row.title}
            className="welcome-row"
            style={{ "--i": i } as CSSProperties}
          >
            <span className="welcome-row__badge" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <p className="welcome-row__title">{row.title}</p>
              <p className="welcome-row__line">{row.line}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="plover-btn-brand" onClick={onNext}>
        Continue
      </button>
    </>
  );
}

export function CalendarStep({
  connected,
  needsSignIn,
  onNext,
}: {
  connected: boolean;
  needsSignIn: boolean;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const result = await sendCommand({ type: "calendar/connect" });
    if (!result.ok) setError(result.error);
  }

  return (
    <>
      <Heading>Want a heads-up before meetings?</Heading>
      <p className="welcome-body">
        Connect Google Calendar and I&apos;ll warn you if a focus block would
        run into an event. I only read your calendar.
      </p>
      {connected ? (
        <>
          <p className="welcome-done">
            <span aria-hidden="true" className="welcome-tick">
              ✓
            </span>
            Calendar connected.
          </p>
          <button type="button" className="plover-btn-brand" onClick={onNext}>
            Continue
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="plover-btn-brand"
            disabled={needsSignIn}
            onClick={() => void connect()}
          >
            Connect Google Calendar
          </button>
          {needsSignIn && <p className="welcome-note">Sign in first.</p>}
          {error && <p role="alert">{error}</p>}
          <button type="button" className="plover-btn-text" onClick={onNext}>
            Skip
          </button>
        </>
      )}
    </>
  );
}

type PinPhase = "wait" | "menu" | "hover" | "click" | "pinned" | "done";

const PIN_STEPS: [PinPhase, number][] = [
  ["hover", 550],
  ["click", 900],
  ["pinned", 250],
  ["done", 1100],
];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function flyInto(from: HTMLElement, to: HTMLElement) {
  const r0 = from.getBoundingClientRect();
  const r1 = to.getBoundingClientRect();
  const flier = from.cloneNode(true) as HTMLElement;
  flier.classList.add("welcome-flier");
  Object.assign(flier.style, {
    left: `${r0.left}px`,
    top: `${r0.top}px`,
    width: `${r0.width}px`,
    height: `${r0.height}px`,
  });
  document.body.append(flier);
  from.style.visibility = "hidden";
  const s = 0.22;
  const x = r1.left + r1.width / 2 - (r0.width * s) / 2 - r0.left;
  const y = r1.top + r1.height / 2 - (r0.height * s) / 2 - r0.top;
  const at = (dx: number, dy: number, scale: number, turn = 0) =>
    `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${turn}deg)`;
  const flight = flier.animate(
    [
      { transform: at(0, 0, 1) },
      { transform: at(0, 6, 1.04), offset: 0.1 },
      { transform: at(x / 2 + 30, Math.min(0, y) - 10, 0.6, -8), offset: 0.55 },
      { transform: at(x, y, s), opacity: 1, offset: 0.92 },
      { transform: at(x, y, s * 0.6), opacity: 0 },
    ],
    {
      duration: 820,
      easing: "cubic-bezier(0.45, 0, 0.35, 1)",
      fill: "forwards",
    },
  );
  return {
    landed: flight.finished,
    cleanup: () => flier.remove(),
  };
}

function usePinnedToToolbar() {
  const [pinned, setPinned] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void browser.action.getUserSettings().then((s) => {
        if (alive) setPinned(s.isOnToolbar);
      });
    };
    refresh();
    browser.action.onUserSettingsChanged.addListener(refresh);
    return () => {
      alive = false;
      browser.action.onUserSettingsChanged.removeListener(refresh);
    };
  }, []);
  return pinned;
}

const PUZZLE = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z" />
  </svg>
);

const PIN = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 3h6l-1 6.5 3 3.5H7l3-3.5z" />
    <path d="M12 13v8" />
  </svg>
);

const CURSOR = (
  <svg viewBox="0 0 18 24" aria-hidden="true">
    <path
      d="M1 1 L1 19 L6 14.5 L9.5 22 L12.5 20.7 L9 13.3 L15.5 13.3 Z"
      fill="#fff"
      stroke="#111"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);

export function PinStep({
  buddyRef,
  onCelebrate,
}: {
  buddyRef: RefObject<HTMLDivElement | null>;
  onCelebrate: () => void;
}) {
  const pinned = usePinnedToToolbar();
  const [phase, setPhase] = useState<PinPhase>("wait");
  const [run, setRun] = useState(0);
  const puzzleRef = useRef<HTMLSpanElement>(null);
  const wasPinned = useRef<boolean | null>(null);

  useEffect(() => {
    if (pinned && wasPinned.current === false) onCelebrate();
    wasPinned.current = pinned;
  }, [pinned, onCelebrate]);

  useEffect(() => {
    const buddy = buddyRef.current;
    const puzzle = puzzleRef.current;
    if (!buddy || !puzzle) return;
    if (reducedMotion()) {
      const id = setTimeout(() => setPhase("done"), 0);
      return () => clearTimeout(id);
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let flight: ReturnType<typeof flyInto> | null = null;
    const later = (ms: number, fn: () => void) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };
    const comeBack = () => {
      buddy.style.visibility = "";
      buddy.animate(
        [
          { transform: "translateY(-24px)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 360, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    };
    timers.push(setTimeout(() => setPhase("wait"), 0));
    later(650, () => {
      flight = flyInto(buddy, puzzle);
      void flight.landed.then(() => {
        flight?.cleanup();
        if (!alive) return;
        setPhase("menu");
        let at = 0;
        for (const [next, ms] of PIN_STEPS) {
          at += ms;
          later(at, () => setPhase(next));
        }
        later(at + 200, comeBack);
      });
    });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      flight?.cleanup();
      buddy.style.visibility = "";
    };
  }, [buddyRef, run]);

  const menuOpen = phase !== "wait" && phase !== "done";
  const showLogo = pinned === true || phase === "pinned" || phase === "done";

  return (
    <>
      <Heading>Pin me so I&apos;m one click away</Heading>
      {pinned ? (
        <p className="welcome-done">
          <span aria-hidden="true" className="welcome-tick">
            ✓
          </span>
          You pinned me. I&apos;m one click away.
        </p>
      ) : (
        <p className="welcome-body">
          Click the puzzle piece in your toolbar, then the pin next to Plover.
        </p>
      )}
      <div className="welcome-chrome" aria-hidden="true">
        <span className="welcome-chrome__address" />
        <span
          ref={puzzleRef}
          className={
            "welcome-chrome__puzzle" +
            (phase === "menu" ? " welcome-chrome__puzzle--bump" : "")
          }
        >
          {PUZZLE}
        </span>
        <span
          className={
            "welcome-chrome__slot" +
            (showLogo ? " welcome-chrome__slot--on" : "")
          }
        >
          <img src="/icon/48.png" alt="" />
        </span>
        {menuOpen && (
          <div className={`welcome-xmenu welcome-xmenu--${phase}`}>
            <p className="welcome-xmenu__title">Extensions</p>
            <div className="welcome-xmenu__row">
              <img src="/icon/48.png" alt="" />
              <span className="welcome-xmenu__name">Plover</span>
              <span className="welcome-xmenu__pin">
                {PIN}
                <span className="welcome-xmenu__tip">Pin</span>
              </span>
            </div>
            <span className="welcome-xmenu__cursor">{CURSOR}</span>
          </div>
        )}
      </div>
      {!pinned && (
        <button
          type="button"
          className="plover-btn-text"
          onClick={() => setRun((n) => n + 1)}
        >
          Show me again
        </button>
      )}
      <p className="welcome-note">Or press Alt+Shift+O to open me.</p>
      <button
        type="button"
        className="plover-btn-brand"
        onClick={() =>
          void browser.action.openPopup().catch(() => window.close())
        }
      >
        Start my first task
      </button>
    </>
  );
}

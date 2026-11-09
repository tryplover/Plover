import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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

export function PinStep() {
  return (
    <>
      <Heading>Pin me so I&apos;m one click away</Heading>
      <p className="welcome-body">
        Click the puzzle piece in your toolbar, then the pin next to Plover.
      </p>
      <div className="welcome-toolbar" aria-hidden="true">
        <span className="welcome-toolbar__address" />
        <span className="welcome-toolbar__puzzle">🧩</span>
        <span className="welcome-toolbar__pin">
          <Buddy state="idle" />
        </span>
      </div>
      <p className="welcome-note">Or press Alt+Shift+O to open me.</p>
      <button
        type="button"
        className="plover-btn-brand"
        onClick={() => window.close()}
      >
        Start my first task
      </button>
    </>
  );
}

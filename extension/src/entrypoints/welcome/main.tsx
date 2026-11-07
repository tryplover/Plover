import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";
import { PRIVACY_POLICY_URL } from "@/shared/links";
import { sendCommand } from "@/shared/messages";
import type { BuddyAnimationState } from "@/shared/types";
import { Buddy } from "@/ui/components/Buddy";
import { SignIn } from "@/ui/components/SignIn";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./welcome.css";

const STEP_COUNT = 6;
const BUDDY_STATES: BuddyAnimationState[] = [
  "celebrating",
  "idle",
  "working",
  "working",
  "idle",
  "celebrating",
];

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

function Progress({ step }: { step: number }) {
  return (
    <div
      className="welcome-progress"
      role="group"
      aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
    >
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={
            "welcome-dot" +
            (i === step ? " welcome-dot--current" : "") +
            (i < step ? " welcome-dot--done" : "")
          }
        />
      ))}
    </div>
  );
}

function useSiteAccess() {
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

function HelloStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <p className="plover-eyebrow">Welcome</p>
      <Heading>Hi, I&apos;m Plover.</Heading>
      <p className="welcome-body">
        A small work buddy that helps you start, one step at a time.
      </p>
      <button type="button" className="plover-btn-brand" onClick={onNext}>
        Let&apos;s get set up
      </button>
    </>
  );
}

function SignInStep({
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
      <Heading>First, sign in</Heading>
      <p className="welcome-body">
        Your tasks stay on this device. Signing in lets Plover suggest steps for
        you.
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

function SiteAccessStep({ onNext }: { onNext: () => void }) {
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
          <button
            type="button"
            className="plover-btn-brand"
            onClick={() =>
              void browser.permissions
                .request({ origins: [ALL_SITES] })
                .then((ok) => setDeclined(!ok))
            }
          >
            Put Plover on my pages
          </button>
          <button type="button" className="plover-btn-text" onClick={onNext}>
            Not now
          </button>
          {declined && (
            <p role="status" className="welcome-note">
              No problem. The Plover popup can add it one site at a time.
            </p>
          )}
        </>
      )}
    </>
  );
}

const HOW_IT_WORKS = [
  {
    title: "Break it down",
    line: "Tell me the task. I'll suggest small steps you can edit.",
  },
  {
    title: "Focus for a block",
    line: "Start a 25-minute timer. Focus mode blocks your distracting sites.",
  },
  {
    title: "Tick off a step",
    line: "When the block ends, tell me what you finished. Then take a break.",
  },
];

function HowStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <Heading>Here&apos;s how it works</Heading>
      <ol className="welcome-rows">
        {HOW_IT_WORKS.map((row, i) => (
          <li
            key={row.title}
            className="welcome-row"
            style={{ "--i": i } as React.CSSProperties}
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

function CalendarStep({
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

function PinStep() {
  return (
    <>
      <Heading>You&apos;re all set</Heading>
      <p className="welcome-body">
        Pin me to your toolbar so I&apos;m one click away.
      </p>
      <div className="welcome-toolbar" aria-hidden="true">
        <span className="welcome-toolbar__address" />
        <span className="welcome-toolbar__puzzle">🧩</span>
        <span className="welcome-toolbar__pin">
          <Buddy state="idle" />
        </span>
      </div>
      <p className="welcome-note">Or press Alt+Shift+P to open me.</p>
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

function Welcome() {
  const { local, ready } = useExtensionState();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const next = useCallback(() => {
    setDirection("forward");
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }, []);
  const back = useCallback(() => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  if (!ready) return null;

  return (
    <main className="welcome">
      <Progress step={step} />
      <div key={step} className="welcome-buddy">
        <Buddy state={BUDDY_STATES[step] ?? "idle"} />
      </div>
      <section className="welcome-card">
        <div key={step} className="welcome-step" data-direction={direction}>
          {step === 0 && <HelloStep onNext={next} />}
          {step === 1 && (
            <SignInStep needsSignIn={local.needsSignIn} onNext={next} />
          )}
          {step === 2 && <SiteAccessStep onNext={next} />}
          {step === 3 && <HowStep onNext={next} />}
          {step === 4 && (
            <CalendarStep
              connected={local.calendarConnected}
              needsSignIn={local.needsSignIn}
              onNext={next}
            />
          )}
          {step === 5 && <PinStep />}
        </div>
        {step > 0 && (
          <button
            type="button"
            className="plover-btn-text welcome-back"
            onClick={back}
          >
            Back
          </button>
        )}
      </section>
      {step === STEP_COUNT - 1 && (
        <p className="welcome-privacy">
          Your tasks stay on this device.{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>
      )}
    </main>
  );
}

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Welcome />);
}

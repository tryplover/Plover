import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { PRIVACY_POLICY_URL } from "@/shared/links";
import { Buddy } from "@/ui/components/Buddy";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import {
  CalendarStep,
  HelloStep,
  HowStep,
  PinStep,
  SignInStep,
  SiteAccessStep,
  useSiteAccess,
} from "./steps";
import "@/ui/base.css";
import "./welcome.css";

const STEP_COUNT = 6;
const CELEBRATE_MS = 1800;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Progress({ step }: { step: number }) {
  return (
    <div
      className="welcome-progress"
      role="group"
      aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
    >
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <span
          key={i === step ? `now-${step}` : i}
          aria-hidden="true"
          className={
            "welcome-seg" +
            (i <= step ? " welcome-seg--on" : "") +
            (i === step ? " welcome-seg--now" : "")
          }
        >
          <span className="welcome-seg__fill" />
        </span>
      ))}
    </div>
  );
}

function useCelebration() {
  const [party, setParty] = useState(0);
  const [active, setActive] = useState(false);
  const celebrate = useCallback(() => {
    setParty((n) => n + 1);
    setActive(true);
  }, []);
  useEffect(() => {
    if (party === 0) return;
    const id = setTimeout(() => setActive(false), CELEBRATE_MS);
    return () => clearTimeout(id);
  }, [party]);
  return { party, active, celebrate };
}

function useBecameTrue(value: boolean, onTrue: () => void) {
  const prev = useRef(value);
  useEffect(() => {
    if (value && !prev.current) onTrue();
    prev.current = value;
  }, [value, onTrue]);
}

function Welcome() {
  const { local, ready } = useExtensionState();
  const siteAccess = useSiteAccess();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const { party, active, celebrate } = useCelebration();
  const buddyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const cardHeight = useRef<number | null>(null);

  const next = useCallback(() => {
    setDirection("forward");
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }, []);
  const back = useCallback(() => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  useBecameTrue(ready && !local.needsSignIn, celebrate);
  useBecameTrue(siteAccess, celebrate);
  useBecameTrue(ready && local.calendarConnected, celebrate);

  useEffect(() => {
    if (step === 0) celebrate();
  }, [step, celebrate]);

  useEffect(() => {
    const el = buddyRef.current;
    if (!el || reducedMotion()) return;
    el.animate(
      [
        { transform: "translateY(0) scale(1, 1)" },
        { transform: "translateY(0) scale(1.06, 0.9)", offset: 0.15 },
        { transform: "translateY(-16px) scale(0.96, 1.05)", offset: 0.5 },
        { transform: "translateY(0) scale(1.05, 0.93)", offset: 0.85 },
        { transform: "none" },
      ],
      { duration: 520, easing: "ease-out" },
    );
  }, [step]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const to = el.offsetHeight;
    const from = cardHeight.current;
    cardHeight.current = to;
    if (from === null || from === to || reducedMotion()) return;
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 320,
      easing: EASE,
    });
  }, [step, ready, local.needsSignIn, local.calendarConnected, siteAccess]);

  if (!ready) return null;

  return (
    <main className="welcome">
      <Progress step={step} />
      <div ref={buddyRef} className="welcome-buddy">
        <Buddy key={party} state={active ? "celebrating" : "working"} />
      </div>
      <section ref={cardRef} className="welcome-card">
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
          {step === 5 && (
            <PinStep buddyRef={buddyRef} onCelebrate={celebrate} />
          )}
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
          I keep your tasks on this device.{" "}
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

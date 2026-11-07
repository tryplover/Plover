import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { PRIVACY_POLICY_URL } from "@/shared/links";
import type { BuddyAnimationState } from "@/shared/types";
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
} from "./steps";
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

export type OnboardingPhase = 'welcome' | 'setup' | 'task' | 'done';

interface OnboardingStepperProps {
  phase: OnboardingPhase;
}

export function OnboardingStepper({ phase }: OnboardingStepperProps) {
  return (
    <nav className="plover-onboarding__stepper" aria-label="Onboarding Progress">
      <div
        className={`plover-onboarding__stepper-step ${
          phase === 'welcome'
            ? 'plover-onboarding__stepper-step--active'
            : 'plover-onboarding__stepper-step--completed'
        }`}
      >
        <span className="plover-onboarding__stepper-bullet" />
        <span>Welcome</span>
      </div>
      <span className="plover-onboarding__stepper-line" />

      <div
        className={`plover-onboarding__stepper-step ${
          phase === 'setup'
            ? 'plover-onboarding__stepper-step--active'
            : phase !== 'welcome'
              ? 'plover-onboarding__stepper-step--completed'
              : ''
        }`}
      >
        <span className="plover-onboarding__stepper-bullet" />
        <span>Setup</span>
      </div>
      <span className="plover-onboarding__stepper-line" />

      <div
        className={`plover-onboarding__stepper-step ${
          phase === 'task'
            ? 'plover-onboarding__stepper-step--active'
            : phase === 'done'
              ? 'plover-onboarding__stepper-step--completed'
              : ''
        }`}
      >
        <span className="plover-onboarding__stepper-bullet" />
        <span>Your first task</span>
      </div>
      <span className="plover-onboarding__stepper-line" />

      <div
        className={`plover-onboarding__stepper-step ${
          phase === 'done' ? 'plover-onboarding__stepper-step--active' : ''
        }`}
      >
        <span className="plover-onboarding__stepper-bullet" />
        <span>Done</span>
      </div>
    </nav>
  );
}

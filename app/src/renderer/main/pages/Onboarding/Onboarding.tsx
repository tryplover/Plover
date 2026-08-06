import { useState } from 'react';
import './Onboarding.css';
import { StepWelcome } from './steps/StepWelcome/StepWelcome';
import { StepUseCase } from './steps/StepUseCase/StepUseCase';
import { StepPromise } from './steps/StepPromise/StepPromise';
import { StepGrantAccess } from './steps/StepGrantAccess/StepGrantAccess';
import { StepSetupComplete } from './steps/StepSetupComplete/StepSetupComplete';
import { StepTaskCarousel } from './steps/StepTaskCarousel/StepTaskCarousel';
import { StepTrialClose } from './steps/StepTrialClose/StepTrialClose';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedUsecases, setSelectedUsecases] = useState<string[]>([]);
  const appName = 'Finish the methods section of my thesis';
  const isWindows = window.api?.platform === 'win32';
  const [showSignInPanel, setShowSignInPanel] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [trialCloseMode, setTrialCloseMode] = useState<'signup' | 'signin'>('signup');
  const [guidedSlideIndex, setGuidedSlideIndex] = useState(0);

  const handleSignInSuccess = () => {
    localStorage.setItem('plover_onboarding_completed', 'true');
    onComplete();
  };

  const handleToggleUsecase = (label: string) => {
    setSelectedUsecases((prev) =>
      prev.includes(label) ? prev.filter((u) => u !== label) : [...prev, label],
    );
  };

  const handleNext = () => {
    setStep((prev) => {
      if (prev === 5) return 9;
      return prev + 1;
    });
  };

  const handleOpenSettingsAndRequest = async () => {
    void window.api.requestScreenRecording();
    void window.api.openScreenRecordingSettings();
    handleNext();
  };

  const handleBack = () => {
    setStep((prev) => {
      if (prev === 9) return 5;
      return prev - 1;
    });
  };

  const completeOnboardingWithGoal = async () => {
    try {
      setFinishError(null);
      localStorage.setItem('plover_onboarding_completed', 'true');
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setFinishError(err instanceof Error ? err.message : String(err));
    }
  };

  // Helper to determine the stepper phase status
  const getStepPhase = (): 'welcome' | 'setup' | 'task' | 'done' => {
    if (step <= 1) return 'welcome';
    if (step <= 3) return 'setup';
    if (step <= 8) return 'task';
    return 'done';
  };

  const phase = getStepPhase();

  return (
    <div className="plover-onboarding" data-testid="onboarding-wizard">
      {/* Custom Titlebar */}
      <header className="plover-onboarding__titlebar">
        <div className="plover-onboarding__left-spacer" />

        {/* Stepper */}
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

        {!isWindows ? (
          <div style={{ width: '80px' }} />
        ) : (
          <div className="plover-onboarding__right-container">
            <div className="plover-onboarding__win-overlay-spacer" />
          </div>
        )}
      </header>

      {/* Main Body content based on step */}
      <main className="plover-onboarding__body">
        {step === 0 && (
          <StepWelcome
            showSignInPanel={showSignInPanel}
            onShowSignInPanel={() => setShowSignInPanel(true)}
            onNext={handleNext}
            onSignInSuccess={handleSignInSuccess}
          />
        )}

        {step === 1 && (
          <StepUseCase
            selectedUsecases={selectedUsecases}
            onToggleUsecase={handleToggleUsecase}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {step === 2 && <StepPromise onBack={handleBack} onNext={handleNext} />}

        {step === 3 && (
          <StepGrantAccess
            onBack={handleBack}
            onOpenSettings={() => void handleOpenSettingsAndRequest()}
          />
        )}

        {step === 4 && <StepSetupComplete onBack={handleBack} onNext={handleNext} />}

        {step === 5 && (
          <StepTaskCarousel
            appName={appName}
            guidedSlideIndex={guidedSlideIndex}
            setGuidedSlideIndex={setGuidedSlideIndex}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {step === 9 && (
          <StepTrialClose
            trialCloseMode={trialCloseMode}
            setTrialCloseMode={setTrialCloseMode}
            finishError={finishError}
            onBack={handleBack}
            onAuthSuccess={() => void completeOnboardingWithGoal()}
          />
        )}
      </main>
    </div>
  );
}

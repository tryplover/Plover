import { useState } from 'react';
import { OnboardingStepper, type OnboardingPhase } from './OnboardingStepper/OnboardingStepper';
import { StepWelcome } from './steps/StepWelcome/StepWelcome';
import { StepUseCase } from './steps/StepUseCase/StepUseCase';
import { StepPromise } from './steps/StepPromise/StepPromise';
import { StepGrantAccess } from './steps/StepGrantAccess/StepGrantAccess';
import { StepSetupComplete } from './steps/StepSetupComplete/StepSetupComplete';
import { StepTaskCarousel } from './steps/StepTaskCarousel/StepTaskCarousel';
import { StepTrialClose } from './steps/StepTrialClose/StepTrialClose';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: () => void;
}

function phaseForStep(step: number): OnboardingPhase {
  if (step <= 1) return 'welcome';
  if (step <= 3) return 'setup';
  if (step <= 8) return 'task';
  return 'done';
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedUsecases, setSelectedUsecases] = useState<string[]>([]);
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

  const handleOpenSettingsAndRequest = () => {
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

  const completeOnboardingWithGoal = () => {
    try {
      setFinishError(null);
      localStorage.setItem('plover_onboarding_completed', 'true');
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setFinishError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="plover-onboarding" data-testid="onboarding-wizard">
      <header className="plover-onboarding__titlebar">
        <div className="plover-onboarding__left-spacer" />

        <OnboardingStepper phase={phaseForStep(step)} />

        {!isWindows ? (
          <div style={{ width: '80px' }} />
        ) : (
          <div className="plover-onboarding__right-container">
            <div className="plover-onboarding__win-overlay-spacer" />
          </div>
        )}
      </header>

      <main className="plover-onboarding__body">
        {step === 0 && (
          <StepWelcome
            showSignInPanel={showSignInPanel}
            onRevealSignIn={() => setShowSignInPanel(true)}
            onSignInSuccess={handleSignInSuccess}
            onNext={handleNext}
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
          <StepGrantAccess onBack={handleBack} onOpenSettings={handleOpenSettingsAndRequest} />
        )}

        {step === 4 && <StepSetupComplete onBack={handleBack} onNext={handleNext} />}

        {step === 5 && (
          <StepTaskCarousel
            slideIndex={guidedSlideIndex}
            onSlideIndexChange={setGuidedSlideIndex}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {step === 9 && (
          <StepTrialClose
            mode={trialCloseMode}
            onToggleMode={() =>
              setTrialCloseMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))
            }
            onBack={handleBack}
            onAuthSuccess={completeOnboardingWithGoal}
            finishError={finishError}
          />
        )}
      </main>
    </div>
  );
}

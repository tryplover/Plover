import { useState } from 'react';
import './Onboarding.css';
import { Step0Welcome } from './onboarding/components/Step0Welcome.js';
import { Step1Usecase } from './onboarding/components/Step1Usecase.js';
import { Step2Promise } from './onboarding/components/Step2Promise.js';
import { Step3Permission } from './onboarding/components/Step3Permission.js';
import { Step4Interstitial } from './onboarding/components/Step4Interstitial.js';
import { Step5GuidedName } from './onboarding/components/Step5GuidedName.js';
import { Step6GuidedBreakdown } from './onboarding/components/Step6GuidedBreakdown.js';
import { Step7GuidedConnect } from './onboarding/components/Step7GuidedConnect.js';
import { Step8GuidedProgress } from './onboarding/components/Step8GuidedProgress.js';
import { Step9TrialClose } from './onboarding/components/Step9TrialClose.js';

interface OnboardingProps {
  onComplete: () => void;
}

const usecases = [
  { label: 'Essays & papers', icon: '✎' },
  { label: 'Reading & research', icon: '☰' },
  { label: 'Problem sets', icon: '∑' },
  { label: 'Digital projects', icon: '✍' },
  { label: 'Daily study sessions', icon: '◷' },
  { label: 'Something else', icon: '✦' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedUsecases, setSelectedUsecases] = useState<string[]>([
    'Essays & papers',
    'Digital projects',
  ]);
  const [appName, setAppName] = useState('Finish the methods section of my thesis');

  const handleToggleUsecase = (label: string) => {
    setSelectedUsecases((prev) =>
      prev.includes(label) ? prev.filter((u) => u !== label) : [...prev, label],
    );
  };

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const date = now.getDate();

      const goal = {
        title: appName,
        description: 'Write the methodology section for the university thesis draft.',
        deadline: new Date(year, month, date + 14).toISOString(),
      };

      const tasks = [
        { title: 'Outline the section structure', estimate_minutes: 30, depends_on: [] },
        { title: 'Gather source citations', estimate_minutes: 45, depends_on: [] },
        { title: 'Write the procedure paragraph', estimate_minutes: 60, depends_on: ['0'] },
        { title: 'Write the analysis paragraph', estimate_minutes: 60, depends_on: ['1', '2'] },
        { title: 'Proofread & finalize', estimate_minutes: 30, depends_on: ['3'] },
      ];

      const scheduledSlots = [
        {
          tempIndex: 0,
          start: new Date(year, month, date, 9, 0).toISOString(),
          end: new Date(year, month, date, 9, 30).toISOString(),
        },
        {
          tempIndex: 1,
          start: new Date(year, month, date, 9, 30).toISOString(),
          end: new Date(year, month, date, 10, 15).toISOString(),
        },
        {
          tempIndex: 2,
          start: new Date(year, month, date, 10, 15).toISOString(),
          end: new Date(year, month, date, 11, 15).toISOString(),
        },
        {
          tempIndex: 3,
          start: new Date(year, month, date, 11, 15).toISOString(),
          end: new Date(year, month, date, 12, 15).toISOString(),
        },
        {
          tempIndex: 4,
          start: new Date(year, month, date, 13, 0).toISOString(),
          end: new Date(year, month, date, 13, 30).toISOString(),
        },
      ];

      await window.api.saveGoalAndTasks(goal, tasks, scheduledSlots);
    } catch (err) {
      console.error('Failed to save initial goal during onboarding:', err);
    } finally {
      onComplete();
    }
  };

  const getStepPhase = (): 'welcome' | 'setup' | 'task' | 'done' => {
    if (step <= 1) return 'welcome';
    if (step <= 3) return 'setup';
    if (step <= 8) return 'task';
    return 'done';
  };

  const phase = getStepPhase();

  return (
    <div className="plover-onboarding" data-testid="onboarding-wizard">
      <header className="plover-onboarding__titlebar">
        <div className="plover-onboarding__dots">
          <span className="plover-onboarding__dot plover-onboarding__dot--red" />
          <span className="plover-onboarding__dot plover-onboarding__dot--yellow" />
          <span className="plover-onboarding__dot plover-onboarding__dot--green" />
        </div>

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

        <div className="plover-onboarding__lang">English ⌄</div>
      </header>

      <main className="plover-onboarding__body">
        {step === 0 && <Step0Welcome onNext={handleNext} />}
        {step === 1 && (
          <Step1Usecase
            usecases={usecases}
            selectedUsecases={selectedUsecases}
            onToggleUsecase={handleToggleUsecase}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}
        {step === 2 && <Step2Promise onBack={handleBack} onNext={handleNext} />}
        {step === 3 && <Step3Permission onBack={handleBack} onNext={handleNext} />}
        {step === 4 && <Step4Interstitial onBack={handleBack} onNext={handleNext} />}
        {step === 5 && (
          <Step5GuidedName
            appName={appName}
            setAppName={setAppName}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}
        {step === 6 && <Step6GuidedBreakdown appName={appName} onBack={handleBack} onNext={handleNext} />}
        {step === 7 && <Step7GuidedConnect onBack={handleBack} onNext={handleNext} />}
        {step === 8 && <Step8GuidedProgress onBack={handleBack} onNext={handleNext} />}
        {step === 9 && <Step9TrialClose onBack={handleBack} onFinish={handleFinish} />}
      </main>
    </div>
  );
}

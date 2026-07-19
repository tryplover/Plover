import { useState } from 'react';
import ploverLogo from '../../plover-logo.png';
import './Onboarding.css';

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
  const isWindows = window.api?.platform === 'win32';
  const [authState, setAuthState] = useState<
    { kind: 'idle' } | { kind: 'opened-browser' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const handleCancelSignIn = () => {
    setAuthState({ kind: 'idle' });
  };

  const handleSignIn = () => {
    setAuthState({ kind: 'opened-browser' });
    window.api.signup
      .start()
      .then(() => window.api.signup.complete())
      .then(() => {
        localStorage.setItem('plover_onboarding_completed', 'true');
        onComplete();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setAuthState({ kind: 'error', message });
      });
  };

  const handleToggleUsecase = (label: string) => {
    setSelectedUsecases((prev) =>
      prev.includes(label) ? prev.filter((u) => u !== label) : [...prev, label],
    );
  };

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handleOpenSettingsAndRequest = async () => {
    void window.api.requestScreenRecording();
    void window.api.openScreenRecordingSettings();
    handleNext();
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    try {
      setAuthState({ kind: 'opened-browser' });
      await window.api.signup.start();
      await window.api.signup.complete();

      // Save initial goal and tasks to database so user has immediate dashboard content
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

      // Schedule slots for today starting from 9:00 AM
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
      localStorage.setItem('plover_onboarding_completed', 'true');
      onComplete();
    } catch (err) {
      console.error('Failed to save initial goal during onboarding:', err);
      const message = err instanceof Error ? err.message : String(err);
      setAuthState({ kind: 'error', message });
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
            authState={authState}
            handleNext={handleNext}
            handleSignIn={handleSignIn}
            handleCancelSignIn={handleCancelSignIn}
          />
        )}

        {step === 1 && (
          <StepUsecase
            selectedUsecases={selectedUsecases}
            handleToggleUsecase={handleToggleUsecase}
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 2 && (
          <StepPromise
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 3 && (
          <StepPermission
            handleBack={handleBack}
            handleOpenSettingsAndRequest={handleOpenSettingsAndRequest}
          />
        )}

        {step === 4 && (
          <StepInterstitial
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 5 && (
          <StepGuidedName
            appName={appName}
            setAppName={setAppName}
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 6 && (
          <StepGuidedBreakdown
            appName={appName}
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 7 && (
          <StepGuidedConnect
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 8 && (
          <StepGuidedProgress
            handleBack={handleBack}
            handleNext={handleNext}
          />
        )}

        {step === 9 && (
          <StepTrialClose
            authState={authState}
            handleBack={handleBack}
            handleFinish={handleFinish}
          />
        )}
      </main>
    </div>
  );
}

/* --- Sub-Components representing individual Onboarding steps to reduce Technical Debt --- */

interface StepWelcomeProps {
  authState: { kind: 'idle' } | { kind: 'opened-browser' } | { kind: 'error'; message: string };
  handleNext: () => void;
  handleSignIn: () => void;
  handleCancelSignIn: () => void;
}

function StepWelcome({ authState, handleNext, handleSignIn, handleCancelSignIn }: StepWelcomeProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-welcome">
      <div className="plover-onboarding__split-left">
        <div className="plover-onboarding__brand">
          <img src={ploverLogo} className="plover-onboarding__brand-logo" alt="Plover Logo" />
          <span>Plover</span>
        </div>
        <h1 className="plover-onboarding__title">The Progress Bar That Works</h1>

        <div className="plover-onboarding__auth-container">
          <button
            type="button"
            className="plover-onboarding__btn"
            onClick={handleNext}
            data-testid="btn-get-started"
          >
            Get Started →
          </button>
          <div style={{ marginTop: '20px' }}>
            <button
              className="plover-onboarding__btn-secondary"
              onClick={handleSignIn}
              disabled={authState.kind === 'opened-browser'}
            >
              {authState.kind === 'error'
                ? 'Sign-in failed. Try again?'
                : authState.kind === 'opened-browser'
                  ? 'Waiting for browser…'
                  : 'Already have an account? Sign in'}
            </button>
          </div>
          {authState.kind === 'opened-browser' && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="plover-onboarding__btn-cancel"
                onClick={handleCancelSignIn}
              >
                Cancel sign-in
              </button>
            </div>
          )}
          {authState.kind === 'opened-browser' && (
            <p className="plover-onboarding__auth-status-msg">
              Complete sign-in in your browser. This window will close automatically.
            </p>
          )}
          {authState.kind === 'error' && (
            <p className="plover-onboarding__auth-status-msg plover-onboarding__auth-status-msg--error">
              Sign-in failed: {authState.message}
            </p>
          )}
        </div>

        <p className="plover-onboarding__disclaimer">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
      <div className="plover-onboarding__split-right">
        <div className="plover-onboarding__right-glow" />
        <div className="plover-onboarding__mockup-window plover-onboarding__mockup-window--video">
          <div className="plover-onboarding__mockup-titlebar">
            <div className="plover-onboarding__mockup-dots">
              <span className="plover-onboarding__mockup-dot" />
              <span className="plover-onboarding__mockup-dot" />
              <span className="plover-onboarding__mockup-dot" />
            </div>
            <div className="plover-onboarding__mockup-brand">DEMO</div>
            <div className="plover-onboarding__mockup-right-dots">
              <span className="plover-onboarding__mockup-right-dot" />
              <span className="plover-onboarding__mockup-right-dot" />
              <span className="plover-onboarding__mockup-right-dot" />
            </div>
          </div>
          <div className="plover-onboarding__video-container">
            <video
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="plover-onboarding__video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepUsecaseProps {
  selectedUsecases: string[];
  handleToggleUsecase: (label: string) => void;
  handleBack: () => void;
  handleNext: () => void;
}

function StepUsecase({ selectedUsecases, handleToggleUsecase, handleBack, handleNext }: StepUsecaseProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-usecase">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <h1 className="plover-onboarding__title--center">
            What tasks can Plover help you track?
          </h1>
          <p className="plover-onboarding__desc--center">
            Help Plover understand your tasks better.
          </p>

          <div className="plover-onboarding__chips-grid">
            {usecases.map((usecase) => {
              const isSelected = selectedUsecases.includes(usecase.label);
              return (
                <div
                  key={usecase.label}
                  className={`plover-onboarding__usecase-chip ${
                    isSelected ? 'plover-onboarding__usecase-chip--selected' : ''
                  }`}
                  onClick={() => handleToggleUsecase(usecase.label)}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="plover-onboarding__chip-icon" aria-hidden="true">
                      {usecase.icon}
                    </span>
                    <span>{usecase.label}</span>
                  </div>
                  {isSelected && (
                    <span className="plover-onboarding__chip-check" aria-label="selected">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleNext}
              data-testid="btn-usecase-continue"
            >
              Continue →
            </button>
          </div>
          <p className="plover-onboarding__disclaimer">You can change this anytime.</p>
        </div>
      </div>
    </section>
  );
}

interface StepPromiseProps {
  handleBack: () => void;
  handleNext: () => void;
}

function StepPromise({ handleBack, handleNext }: StepPromiseProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-promise">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <h1 className="plover-onboarding__title--center">Before we go further ...</h1>
          <p className="plover-onboarding__desc--center">
            Plover needs screen-recording permission to read the windows you work in. We
            promise 3 things:
          </p>

          <div className="plover-onboarding__cards-stack">
            <div className="plover-onboarding__promise-card">
              <div className="plover-onboarding__promise-icon-container" aria-hidden="true">
                ◳
              </div>
              <div>
                <h3 className="plover-onboarding__promise-title">Only specified windows</h3>
                <p className="plover-onboarding__promise-desc">
                  You pick the windows. Plover never sees the rest of your screen.
                </p>
              </div>
            </div>

            <div className="plover-onboarding__promise-card">
              <div className="plover-onboarding__promise-icon-container" aria-hidden="true">
                ⦸
              </div>
              <div>
                <h3 className="plover-onboarding__promise-title">Never saved</h3>
                <p className="plover-onboarding__promise-desc">
                  It reads the progress, then forgets the picture. Nothing is stored, ever.
                </p>
              </div>
            </div>

            <div className="plover-onboarding__promise-card">
              <div className="plover-onboarding__promise-icon-container" aria-hidden="true">
                ☖
              </div>
              <div>
                <h3 className="plover-onboarding__promise-title">Yours alone</h3>
                <p className="plover-onboarding__promise-desc">
                  No team dashboard. No manager view. Plover is built for you, and you only.
                </p>
              </div>
            </div>
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleNext}
              data-testid="btn-promise-continue"
            >
              I understand →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepPermissionProps {
  handleBack: () => void;
  handleOpenSettingsAndRequest: () => void;
}

function StepPermission({ handleBack, handleOpenSettingsAndRequest }: StepPermissionProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-permission">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <div
            className="plover-onboarding__widget-container"
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div
              className="plover-onboarding__mockup-window"
              style={{ width: '220px', padding: '16px' }}
            >
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '50%', marginBottom: '8px' }}
              />
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '80%', marginBottom: '8px' }}
              />
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '60%', marginBottom: '16px' }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '42px',
                  borderRadius: '50%',
                  width: '42px',
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  margin: '0 auto',
                  fontSize: '18px',
                  boxShadow: '0 0 0 6px rgba(46, 125, 50, 0.1)',
                }}
              >
                👁
              </div>
            </div>
          </div>

          <h1 className="plover-onboarding__title--center">Now, let's turn it on.</h1>
          <p className="plover-onboarding__desc--center">
            Plover needs screen-recording permission to read your chosen window. macOS will
            ask you to confirm.
          </p>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleOpenSettingsAndRequest}
              data-testid="btn-grant-settings"
            >
              Open System Settings →
            </button>
          </div>
          <p className="plover-onboarding__disclaimer">
            You'll choose which window in the next step.
          </p>
        </div>
      </div>
    </section>
  );
}

interface StepInterstitialProps {
  handleBack: () => void;
  handleNext: () => void;
}

function StepInterstitial({ handleBack, handleNext }: StepInterstitialProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-interstitial">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span className="plover-onboarding__label-capsule">✓ Setup complete</span>
          <h1 className="plover-onboarding__title--center">
            Now let's start your first task.
          </h1>
          <p className="plover-onboarding__desc--center">
            This is exactly how you'll use Plover every day.
          </p>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleNext}
              data-testid="btn-lets-go"
            >
              Let's go →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepGuidedNameProps {
  appName: string;
  setAppName: (name: string) => void;
  handleBack: () => void;
  handleNext: () => void;
}

function StepGuidedName({ appName, setAppName, handleBack, handleNext }: StepGuidedNameProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-name">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span
            className="plover-onboarding__label-capsule"
            style={{ backgroundColor: 'white', border: '1px solid rgba(24,25,26,0.08)' }}
          >
            • Type whatever you're actually working on right now.
          </span>

          <div className="plover-onboarding__mockup-window" style={{ marginBottom: '32px' }}>
            <div className="plover-onboarding__mockup-titlebar">
              <div className="plover-onboarding__mockup-dots">
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
              </div>
              <span className="plover-onboarding__mockup-brand">Plover</span>
              <div className="plover-onboarding__mockup-right-dots" />
            </div>
            <div className="plover-onboarding__mockup-content">
              <div className="plover-onboarding__mockup-label">
                <span className="plover-onboarding__mockup-label-dot" />
                <span>new task</span>
              </div>

              <h2 className="plover-onboarding__mockup-h1">What are you working on?</h2>

              <input
                type="text"
                className="plover-onboarding__mockup-input"
                aria-label="Task name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />

              <h4 className="plover-onboarding__mockup-label-small">How often is this?</h4>
              <div className="plover-onboarding__mockup-pills">
                <span className="plover-onboarding__mockup-pill plover-onboarding__mockup-pill--active">
                  One-off
                </span>
                <span className="plover-onboarding__mockup-pill">Daily</span>
                <span className="plover-onboarding__mockup-pill">Weekly</span>
              </div>

              <div className="plover-onboarding__mockup-footer">
                <span />
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  onClick={handleNext}
                  disabled={!appName.trim()}
                  data-testid="btn-break-steps"
                >
                  Break into steps →
                </button>
              </div>
            </div>
          </div>

          <button className="plover-onboarding__btn-back" onClick={handleBack}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

interface StepGuidedBreakdownProps {
  appName: string;
  handleBack: () => void;
  handleNext: () => void;
}

function StepGuidedBreakdown({ appName, handleBack, handleNext }: StepGuidedBreakdownProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-breakdown">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span
            className="plover-onboarding__label-capsule"
            style={{ backgroundColor: 'white', border: '1px solid rgba(24,25,26,0.08)' }}
          >
            • Plover broke it down, but these are your steps. Edit them however you like.
          </span>

          <div className="plover-onboarding__mockup-window" style={{ marginBottom: '32px' }}>
            <div className="plover-onboarding__mockup-titlebar">
              <div className="plover-onboarding__mockup-dots">
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
              </div>
              <span className="plover-onboarding__mockup-brand">Plover</span>
              <div className="plover-onboarding__mockup-right-dots" />
            </div>
            <div className="plover-onboarding__mockup-content">
              <div className="plover-onboarding__mockup-label">
                <span className="plover-onboarding__mockup-label-dot" />
                <span>Plover suggested 5 steps — edit freely</span>
              </div>

              <h2
                className="plover-onboarding__mockup-h1"
                style={{ fontSize: '24px', marginBottom: '16px' }}
              >
                {appName}
              </h2>

              <div className="plover-onboarding__mockup-steps">
                <div className="plover-onboarding__mockup-step">
                  <span className="plover-onboarding__mockup-step-num">1</span>
                  <span>Outline the section structure</span>
                </div>
                <div className="plover-onboarding__mockup-step">
                  <span className="plover-onboarding__mockup-step-num">2</span>
                  <span>Gather source citations</span>
                </div>
                <div className="plover-onboarding__mockup-step">
                  <span className="plover-onboarding__mockup-step-num">3</span>
                  <span>Write the procedure paragraph</span>
                </div>
                <div className="plover-onboarding__mockup-step">
                  <span className="plover-onboarding__mockup-step-num">4</span>
                  <span>Write the analysis paragraph</span>
                </div>
                <div className="plover-onboarding__mockup-step">
                  <span className="plover-onboarding__mockup-step-num">5</span>
                  <span>Proofread & finalize</span>
                </div>
              </div>

              <div className="plover-onboarding__mockup-add-step">+ Add a step</div>

              <div className="plover-onboarding__mockup-footer">
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)' }}
                  onClick={handleBack}
                >
                  Back
                </button>
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  onClick={handleNext}
                  data-testid="btn-looks-right"
                >
                  Looks right →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepGuidedConnectProps {
  handleBack: () => void;
  handleNext: () => void;
}

function StepGuidedConnect({ handleBack, handleNext }: StepGuidedConnectProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-connect">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span
            className="plover-onboarding__label-capsule"
            style={{ backgroundColor: 'white', border: '1px solid rgba(24,25,26,0.08)' }}
          >
            • Pick the windows Plover should watch.
          </span>

          <div className="plover-onboarding__mockup-window" style={{ marginBottom: '32px' }}>
            <div className="plover-onboarding__mockup-titlebar">
              <div className="plover-onboarding__mockup-dots">
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
                <span className="plover-onboarding__mockup-dot" />
              </div>
              <span className="plover-onboarding__mockup-brand">Plover</span>
              <div className="plover-onboarding__mockup-right-dots" />
            </div>
            <div className="plover-onboarding__mockup-content">
              <div className="plover-onboarding__mockup-label">
                <span className="plover-onboarding__mockup-label-dot" />
                <span>Last step</span>
              </div>

              <h2
                className="plover-onboarding__mockup-h1"
                style={{ fontSize: '24px', marginBottom: '8px' }}
              >
                Which window should I watch?
              </h2>
              <p
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '11px',
                  marginBottom: '20px',
                }}
              >
                I only ever look at the windows you choose.
              </p>

              <div className="plover-onboarding__mockup-app-rows">
                <div className="plover-onboarding__mockup-app-row">
                  <div className="plover-onboarding__mockup-app-left">
                    <span
                      className="plover-onboarding__mockup-app-icon"
                      style={{ backgroundColor: '#2b579a' }}
                    >
                      G
                    </span>
                    <div>
                      <div className="plover-onboarding__mockup-app-name">
                        Google Docs — Thesis draft
                      </div>
                      <div className="plover-onboarding__mockup-app-status">
                        Active now • Chrome
                      </div>
                    </div>
                  </div>
                  <button className="plover-onboarding__mockup-app-watch-btn plover-onboarding__mockup-app-watch-btn--selected">
                    ✓
                  </button>
                </div>

                <div className="plover-onboarding__mockup-app-row">
                  <div className="plover-onboarding__mockup-app-left">
                    <span
                      className="plover-onboarding__mockup-app-icon"
                      style={{ backgroundColor: '#111' }}
                    >
                      N
                    </span>
                    <div>
                      <div className="plover-onboarding__mockup-app-name">
                        Notion — Research notes
                      </div>
                      <div className="plover-onboarding__mockup-app-status">
                        Open • Notion
                      </div>
                    </div>
                  </div>
                  <button className="plover-onboarding__mockup-app-watch-btn">Watch</button>
                </div>

                <div className="plover-onboarding__mockup-app-row">
                  <div className="plover-onboarding__mockup-app-left">
                    <span
                      className="plover-onboarding__mockup-app-icon"
                      style={{ backgroundColor: '#9e0b0f' }}
                    >
                      P
                    </span>
                    <div>
                      <div className="plover-onboarding__mockup-app-name">
                        Preview — sources.pdf
                      </div>
                      <div className="plover-onboarding__mockup-app-status">
                        Open • Preview
                      </div>
                    </div>
                  </div>
                  <button className="plover-onboarding__mockup-app-watch-btn">Watch</button>
                </div>
              </div>

              <div className="plover-onboarding__mockup-footer">
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)' }}
                  onClick={handleBack}
                >
                  Back
                </button>
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  onClick={handleNext}
                  data-testid="btn-start-tracking-mock"
                >
                  Start tracking →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepGuidedProgressProps {
  handleBack: () => void;
  handleNext: () => void;
}

function StepGuidedProgress({ handleBack, handleNext }: StepGuidedProgressProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-progress">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span className="plover-onboarding__label-capsule">✓ You're all set</span>
          <h1 className="plover-onboarding__title--center">
            That's it. Plover's watching now.
          </h1>
          <p className="plover-onboarding__desc--center">
            Get to work — the bar fills as you go. Glance over whenever you like.
          </p>

          <div
            className="plover-onboarding__pill-widget"
            style={{ width: '380px', marginBottom: '40px' }}
          >
            <div className="plover-onboarding__pill-left">
              <span className="plover-onboarding__pill-pulse" />
              <span className="plover-onboarding__pill-status">observing</span>
              <span className="plover-onboarding__pill-sep">•</span>
              <span className="plover-onboarding__pill-title">Draft — methods</span>
            </div>
            <span className="plover-onboarding__pill-pct">4%</span>
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleNext}
              data-testid="btn-start-working"
            >
              Start working →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepTrialCloseProps {
  authState: { kind: 'idle' } | { kind: 'opened-browser' } | { kind: 'error'; message: string };
  handleBack: () => void;
  handleFinish: () => void;
}

function StepTrialClose({ authState, handleBack, handleFinish }: StepTrialCloseProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-trial-close">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span className="plover-onboarding__label-capsule">You're in</span>
          <h1
            className="plover-onboarding__title--center"
            style={{ fontSize: '48px', marginBottom: '20px' }}
          >
            Your first two weeks are on us.
          </h1>
          <p className="plover-onboarding__desc--center" style={{ marginBottom: '32px' }}>
            Full Plover, free for 14 days. No credit card needed. After that, keep going for a
            small monthly plan — or stay on the free tier.
          </p>

          <div className="plover-onboarding__bullets">
            <div className="plover-onboarding__bullet-item">
              <span className="plover-onboarding__bullet-check">✓</span>
              <span>No card required</span>
            </div>
            <div className="plover-onboarding__bullet-item">
              <span className="plover-onboarding__bullet-check">✓</span>
              <span>Cancel anytime</span>
            </div>
            <div className="plover-onboarding__bullet-item">
              <span className="plover-onboarding__bullet-check">✓</span>
              <span>Built for your tasks</span>
            </div>
          </div>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={handleBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={handleFinish}
              disabled={authState.kind === 'opened-browser'}
              data-testid="btn-finish-onboarding"
            >
              {authState.kind === 'error'
                ? 'Sign-up failed. Try again?'
                : authState.kind === 'opened-browser'
                  ? 'Completing sign-up…'
                  : 'Start 14-day trial'}
            </button>
          </div>
          {authState.kind === 'opened-browser' && (
            <p className="plover-onboarding__auth-status-msg" style={{ textAlign: 'center' }}>
              Complete sign-up in your browser. This window will close automatically.
            </p>
          )}
          {authState.kind === 'error' && (
            <p
              className="plover-onboarding__auth-status-msg plover-onboarding__auth-status-msg--error"
              style={{ textAlign: 'center' }}
            >
              Sign-up failed: {authState.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

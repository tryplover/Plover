import { useState } from 'react';
import ploverLogo from '../../../plover-logo.png';
import ploverDemoVideo from '../../../Plover-Demo.mp4';
import { AuthPanel } from '../../../components/AuthPanel/AuthPanel';
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
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
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
                  {showSignInPanel ? (
                    <AuthPanel mode="signin" onSuccess={handleSignInSuccess} />
                  ) : (
                    <button
                      type="button"
                      className="plover-onboarding__btn-secondary"
                      onClick={() => setShowSignInPanel(true)}
                    >
                      Already have an account? Sign in
                    </button>
                  )}
                </div>
              </div>

              <p className="plover-onboarding__disclaimer">
                By continuing you agree to our Terms and Privacy Policy.
              </p>
            </div>
            <div className="plover-onboarding__split-right">
              <div className="plover-onboarding__right-glow" />
              <div className="plover-onboarding__video-frame">
                <video
                  src={ploverDemoVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="plover-onboarding__video"
                />
              </div>
            </div>
          </section>
        )}

        {/* Step 1: Use-case selection */}
        {step === 1 && (
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
        )}

        {/* Step 2: The Promise screen */}
        {step === 2 && (
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
        )}

        {/* Step 3: Grant Access / Open System Settings */}
        {step === 3 && (
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
        )}

        {/* Step 4: Interstitial / Setup complete */}
        {step === 4 && (
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
        )}

        {/* Step 5: Guided Task Workflow Carousel */}
        {step === 5 && (
          <section className="plover-onboarding__slide" data-testid="step-guided-carousel">
            <div className="plover-onboarding__centered">
              <div className="plover-onboarding__center-glow" />
              <div className="plover-onboarding__centered-content">
                {/* 1. Label capsule at the top */}
                {guidedSlideIndex === 0 && (
                  <span
                    className="plover-onboarding__label-capsule"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(24,25,26,0.08)',
                      marginBottom: '32px',
                    }}
                  >
                    • Name the main goal you want to accomplish.
                  </span>
                )}
                {guidedSlideIndex === 1 && (
                  <span
                    className="plover-onboarding__label-capsule"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(24,25,26,0.08)',
                      marginBottom: '32px',
                    }}
                  >
                    • Plover automatically breaks down your goal into clear, trackable steps.
                  </span>
                )}
                {guidedSlideIndex === 2 && (
                  <span
                    className="plover-onboarding__label-capsule"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(24,25,26,0.08)',
                      marginBottom: '32px',
                    }}
                  >
                    • Connect the documents and applications you want Plover to watch.
                  </span>
                )}
                {guidedSlideIndex === 3 && (
                  <span
                    className="plover-onboarding__label-capsule"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(24,25,26,0.08)',
                      marginBottom: '32px',
                    }}
                  >
                    ✓ You're all set — Plover automatically fills the progress bar as you work.
                  </span>
                )}

                {/* Carousel container with Left/Right arrows on each side */}
                <div className="plover-onboarding__carousel-wrapper">
                  {/* Left round arrow button */}
                  <button
                    type="button"
                    className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--left"
                    onClick={() => setGuidedSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={guidedSlideIndex === 0}
                    data-testid="carousel-arrow-left"
                    aria-label="Previous slide"
                  >
                    ←
                  </button>

                  {/* Mockup Window representing the current slide */}
                  <div
                    className="plover-onboarding__mockup-window"
                    style={{ marginBottom: '0' }}
                    data-testid={`guided-slide-${guidedSlideIndex}`}
                  >
                    <div className="plover-onboarding__mockup-titlebar">
                      <div className="plover-onboarding__mockup-dots">
                        <span className="plover-onboarding__mockup-dot" />
                        <span className="plover-onboarding__mockup-dot" />
                        <span className="plover-onboarding__mockup-dot" />
                      </div>
                      <span className="plover-onboarding__mockup-brand">Plover</span>
                      <div className="plover-onboarding__mockup-right-dots" />
                    </div>

                    {guidedSlideIndex === 0 && (
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
                          readOnly
                          style={{ cursor: 'default' }}
                        />
                        <h4 className="plover-onboarding__mockup-label-small">
                          How often is this?
                        </h4>
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
                            type="button"
                            className="plover-onboarding__mockup-btn-primary"
                            style={{ cursor: 'default' }}
                          >
                            Break into steps →
                          </button>
                        </div>
                      </div>
                    )}

                    {guidedSlideIndex === 1 && (
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
                        <div
                          className="plover-onboarding__mockup-add-step"
                          style={{ cursor: 'default' }}
                        >
                          + Add a step
                        </div>
                        <div className="plover-onboarding__mockup-footer">
                          <span />
                          <button
                            type="button"
                            className="plover-onboarding__mockup-btn-primary"
                            style={{ cursor: 'default' }}
                          >
                            Looks right →
                          </button>
                        </div>
                      </div>
                    )}

                    {guidedSlideIndex === 2 && (
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
                            <button
                              type="button"
                              className="plover-onboarding__mockup-app-watch-btn plover-onboarding__mockup-app-watch-btn--selected"
                            >
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
                            <button
                              type="button"
                              className="plover-onboarding__mockup-app-watch-btn"
                            >
                              Watch
                            </button>
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
                            <button
                              type="button"
                              className="plover-onboarding__mockup-app-watch-btn"
                            >
                              Watch
                            </button>
                          </div>
                        </div>
                        <div className="plover-onboarding__mockup-footer">
                          <span />
                          <button
                            type="button"
                            className="plover-onboarding__mockup-btn-primary"
                            style={{ cursor: 'default' }}
                          >
                            Start tracking →
                          </button>
                        </div>
                      </div>
                    )}

                    {guidedSlideIndex === 3 && (
                      <div
                        className="plover-onboarding__mockup-content"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '40px 24px',
                          textAlign: 'center',
                        }}
                      >
                        <h2
                          className="plover-onboarding__mockup-h1"
                          style={{ fontSize: '24px', marginBottom: '8px' }}
                        >
                          That's it. Plover's watching.
                        </h2>
                        <p
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '12px',
                            marginBottom: '24px',
                            maxWidth: '280px',
                          }}
                        >
                          Get to work — the bar fills as you go. Glance over whenever you like.
                        </p>
                        <div
                          className="plover-onboarding__pill-widget"
                          style={{
                            width: '100%',
                            maxWidth: '320px',
                            marginBottom: '24px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <div className="plover-onboarding__pill-left">
                            <span className="plover-onboarding__pill-pulse" />
                            <span className="plover-onboarding__pill-status">observing</span>
                            <span className="plover-onboarding__pill-sep">•</span>
                            <span className="plover-onboarding__pill-title">Draft — methods</span>
                          </div>
                          <span className="plover-onboarding__pill-pct">4%</span>
                        </div>
                        <div
                          className="plover-onboarding__mockup-footer"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <button
                            type="button"
                            className="plover-onboarding__mockup-btn-primary"
                            style={{ cursor: 'default' }}
                          >
                            Start working →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right round arrow button */}
                  <button
                    type="button"
                    className="plover-onboarding__carousel-arrow plover-onboarding__carousel-arrow--right"
                    onClick={() => setGuidedSlideIndex((prev) => Math.min(3, prev + 1))}
                    disabled={guidedSlideIndex === 3}
                    data-testid="carousel-arrow-right"
                    aria-label="Next slide"
                  >
                    →
                  </button>
                </div>

                {/* Carousel little dots indicator at the bottom */}
                <div
                  className="plover-onboarding__carousel-dots"
                  style={{ marginTop: '24px', marginBottom: '32px' }}
                >
                  {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`plover-onboarding__carousel-dot${idx === guidedSlideIndex ? ' plover-onboarding__carousel-dot--active' : ''}`}
                      onClick={() => setGuidedSlideIndex(idx)}
                      data-testid={`carousel-indicator-${idx}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Navigation Back & Continue buttons */}
                <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
                  {guidedSlideIndex < 3 ? (
                    <button className="plover-onboarding__btn-back" onClick={handleBack}>
                      Back
                    </button>
                  ) : (
                    <button
                      className="plover-onboarding__btn"
                      onClick={handleNext}
                      data-testid="btn-carousel-continue"
                    >
                      Continue →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Step 9: Trial close */}
        {step === 9 && (
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
                  Full Plover, free for 14 days. No credit card needed.
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
                </div>
                <div
                  style={{
                    marginTop: '20px',
                    maxWidth: '360px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                >
                  <AuthPanel
                    mode={trialCloseMode}
                    onSuccess={() => void completeOnboardingWithGoal()}
                  />
                  <button
                    type="button"
                    className="plover-onboarding__btn-secondary"
                    onClick={() =>
                      setTrialCloseMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))
                    }
                    style={{
                      display: 'block',
                      marginTop: '12px',
                      textAlign: 'center',
                      width: '100%',
                    }}
                    data-testid="btn-trial-close-toggle-mode"
                  >
                    {trialCloseMode === 'signup'
                      ? 'Already have an account? Sign in'
                      : 'Need an account? Sign up'}
                  </button>
                </div>
                {finishError && (
                  <p
                    className="plover-onboarding__auth-status-msg plover-onboarding__auth-status-msg--error"
                    style={{ textAlign: 'center', marginTop: '16px' }}
                  >
                    {finishError}
                  </p>
                )}
                <p className="plover-onboarding__disclaimer">
                  You can review your plan anytime in Settings.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

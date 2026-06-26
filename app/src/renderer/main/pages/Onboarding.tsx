import { useState } from 'react';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedUsecases, setSelectedUsecases] = useState<string[]>([
    'Essays & papers',
    'Digital projects',
  ]);
  const [appName, setAppName] = useState('Finish the methods section of my thesis');

  const usecases = [
    { label: 'Essays & papers', icon: '✎' },
    { label: 'Reading & research', icon: '☰' },
    { label: 'Problem sets', icon: '∑' },
    { label: 'Digital projects', icon: '✍' },
    { label: 'Daily study sessions', icon: '◷' },
    { label: 'Something else', icon: '✦' },
  ];

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
    } catch (err) {
      console.error('Failed to save initial goal during onboarding:', err);
    } finally {
      onComplete();
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
        <div className="plover-onboarding__dots">
          <span className="plover-onboarding__dot plover-onboarding__dot--red" />
          <span className="plover-onboarding__dot plover-onboarding__dot--yellow" />
          <span className="plover-onboarding__dot plover-onboarding__dot--green" />
        </div>

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

        <div className="plover-onboarding__lang">English ⌄</div>
      </header>

      {/* Main Body content based on step */}
      <main className="plover-onboarding__body">
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <section className="plover-onboarding__slide" data-testid="step-welcome">
            <div className="plover-onboarding__split-left">
              <div className="plover-onboarding__brand">
                <span className="plover-onboarding__brand-icon">❙❙❙</span>
                <span>Plover</span>
              </div>
              <h1 className="plover-onboarding__title">See your progress as you actually work.</h1>
              <p className="plover-onboarding__desc">
                Plover is a progress bar that quietly fills as your work gets done.
              </p>
              <div>
                <button
                  className="plover-onboarding__btn"
                  onClick={handleNext}
                  data-testid="btn-get-started"
                >
                  Get started →
                </button>
              </div>
              <p className="plover-onboarding__disclaimer">
                By continuing you agree to our Terms and Privacy Policy.
              </p>
            </div>
            <div className="plover-onboarding__split-right">
              <div className="plover-onboarding__right-glow" />
              <h2 className="plover-onboarding__right-title">Just define it, and watch it fill.</h2>
              <div className="plover-onboarding__mockup-window">
                <div className="plover-onboarding__mockup-titlebar">
                  <div className="plover-onboarding__mockup-dots">
                    <span className="plover-onboarding__mockup-dot" />
                    <span className="plover-onboarding__mockup-dot" />
                    <span className="plover-onboarding__mockup-dot" />
                  </div>
                  <div className="plover-onboarding__mockup-brand">PLOVER</div>
                  <div className="plover-onboarding__mockup-right-dots">
                    <span className="plover-onboarding__mockup-right-dot" />
                    <span className="plover-onboarding__mockup-right-dot" />
                    <span className="plover-onboarding__mockup-right-dot" />
                  </div>
                </div>
                <div className="plover-onboarding__mockup-content">
                  <div className="plover-onboarding__skeleton" style={{ width: '45%' }} />
                  <div className="plover-onboarding__skeleton" style={{ width: '70%' }} />
                  <div className="plover-onboarding__skeleton" style={{ width: '55%' }} />
                  <div className="plover-onboarding__skeleton" style={{ width: '35%' }} />

                  <div className="plover-onboarding__pill-widget">
                    <div className="plover-onboarding__pill-left">
                      <span className="plover-onboarding__pill-pulse" />
                      <span className="plover-onboarding__pill-status">observing</span>
                      <span className="plover-onboarding__pill-sep">•</span>
                      <span className="plover-onboarding__pill-title">Draft — methods</span>
                    </div>
                    <span className="plover-onboarding__pill-pct">65%</span>
                  </div>
                </div>
              </div>
              <div className="plover-onboarding__carousel-dots">
                <span className="plover-onboarding__carousel-dot" />
                <span className="plover-onboarding__carousel-dot" />
                <span className="plover-onboarding__carousel-dot plover-onboarding__carousel-dot--active" />
                <span className="plover-onboarding__carousel-dot" />
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
                          <span className="plover-onboarding__chip-icon">{usecase.icon}</span>
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
                    <div className="plover-onboarding__promise-icon-container">◳</div>
                    <div>
                      <h3 className="plover-onboarding__promise-title">Only specified windows</h3>
                      <p className="plover-onboarding__promise-desc">
                        You pick the windows. Plover never sees the rest of your screen.
                      </p>
                    </div>
                  </div>

                  <div className="plover-onboarding__promise-card">
                    <div className="plover-onboarding__promise-icon-container">⦸</div>
                    <div>
                      <h3 className="plover-onboarding__promise-title">Never saved</h3>
                      <p className="plover-onboarding__promise-desc">
                        It reads the progress, then forgets the picture. Nothing is stored, ever.
                      </p>
                    </div>
                  </div>

                  <div className="plover-onboarding__promise-card">
                    <div className="plover-onboarding__promise-icon-container">☖</div>
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
                    onClick={handleNext}
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

        {/* Step 5: Guided - Name */}
        {step === 5 && (
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
        )}

        {/* Step 6: Guided - Breakdown */}
        {step === 6 && (
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
        )}

        {/* Step 7: Guided - Connect */}
        {step === 7 && (
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
        )}

        {/* Step 8: Guided - First progress */}
        {step === 8 && (
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
                    data-testid="btn-finish-onboarding"
                  >
                    Start tracking →
                  </button>
                </div>
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

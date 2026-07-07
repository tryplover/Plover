

interface Step5GuidedNameProps {
  appName: string;
  setAppName: (name: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step5GuidedName({
  appName,
  setAppName,
  onBack,
  onNext,
}: Step5GuidedNameProps) {
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
                  onClick={onNext}
                  disabled={!appName.trim()}
                  data-testid="btn-break-steps"
                >
                  Break into steps →
                </button>
              </div>
            </div>
          </div>

          <button className="plover-onboarding__btn-back" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </section>
  );
}

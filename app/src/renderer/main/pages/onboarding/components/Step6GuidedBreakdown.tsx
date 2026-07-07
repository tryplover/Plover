
interface Step6GuidedBreakdownProps {
  appName: string;
  onBack: () => void;
  onNext: () => void;
}

export function Step6GuidedBreakdown({ appName, onBack, onNext }: Step6GuidedBreakdownProps) {
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
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  className="plover-onboarding__mockup-btn-primary"
                  onClick={onNext}
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

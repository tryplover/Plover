interface Step7GuidedConnectProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step7GuidedConnect({ onNext, onBack }: Step7GuidedConnectProps) {
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
                      <div className="plover-onboarding__mockup-app-status">Open • Notion</div>
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
                      <div className="plover-onboarding__mockup-app-name">Preview — sources.pdf</div>
                      <div className="plover-onboarding__mockup-app-status">Open • Preview</div>
                    </div>
                  </div>
                  <button className="plover-onboarding__mockup-app-watch-btn">Watch</button>
                </div>
              </div>

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

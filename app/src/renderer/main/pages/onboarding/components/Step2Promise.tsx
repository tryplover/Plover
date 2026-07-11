interface Step2PromiseProps {
  handleBack: () => void;
  handleNext: () => void;
}

export function Step2Promise({ handleBack, handleNext }: Step2PromiseProps) {
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

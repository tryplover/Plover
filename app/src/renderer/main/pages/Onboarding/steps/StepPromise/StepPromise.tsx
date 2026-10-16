interface StepPromiseProps {
  onBack: () => void;
  onNext: () => void;
}

export function StepPromise({ onBack, onNext }: StepPromiseProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-promise">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <h1 className="plover-onboarding__title--center">Before we go further ...</h1>
          <div className="plover-onboarding__cards-stack">
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
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={onNext}
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

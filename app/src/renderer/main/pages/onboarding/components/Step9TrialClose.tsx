

interface Step9TrialCloseProps {
  handleBack: () => void;
  handleFinish: () => void;
}

export function Step9TrialClose({ handleBack, handleFinish }: Step9TrialCloseProps) {
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
            Full Plover, free for 14 days. No credit card needed. After that, keep going for a small
            monthly plan — or stay on the free tier.
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
  );
}

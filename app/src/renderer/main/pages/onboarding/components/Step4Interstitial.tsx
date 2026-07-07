
interface Step4InterstitialProps {
  onBack: () => void;
  onNext: () => void;
}

export function Step4Interstitial({ onBack, onNext }: Step4InterstitialProps) {
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
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={onNext}
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

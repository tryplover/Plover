export function Step8GuidedProgress({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-guided-progress">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <span className="plover-onboarding__label-capsule">✓ You're all set</span>
          <h1 className="plover-onboarding__title--center">That's it. Plover's watching now.</h1>
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
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={onNext}
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

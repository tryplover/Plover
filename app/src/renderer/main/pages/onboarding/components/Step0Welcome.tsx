export function Step0Welcome({ onNext }: { onNext: () => void }) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-welcome">
      <div className="plover-onboarding__split-left">
        <div className="plover-onboarding__brand">
          <span className="plover-onboarding__brand-icon" aria-hidden="true">
            ❙❙❙
          </span>
          <span>Plover</span>
        </div>
        <h1 className="plover-onboarding__title">See your progress as you actually work.</h1>
        <p className="plover-onboarding__desc">
          Plover is a progress bar that quietly fills as your work gets done.
        </p>
        <div>
          <button
            className="plover-onboarding__btn"
            onClick={onNext}
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
  );
}

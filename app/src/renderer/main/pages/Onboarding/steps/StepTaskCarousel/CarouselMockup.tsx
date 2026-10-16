const appName = 'Finish the methods section of my thesis';

interface CarouselMockupProps {
  slideIndex: number;
}

export function CarouselMockup({ slideIndex }: CarouselMockupProps) {
  return (
    <div
      className="plover-onboarding__mockup-window"
      style={{ marginBottom: '0' }}
      data-testid={`guided-slide-${slideIndex}`}
    >
      <div className="plover-onboarding__mockup-titlebar">
        <div className="plover-onboarding__mockup-dots">
          <span className="plover-onboarding__mockup-dot" />
          <span className="plover-onboarding__mockup-dot" />
          <span className="plover-onboarding__mockup-dot" />
        </div>
        <span className="plover-onboarding__mockup-brand">Plover</span>
        <div className="plover-onboarding__mockup-right-dots" />
      </div>

      {slideIndex === 0 && (
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
            readOnly
            style={{ cursor: 'default' }}
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
              type="button"
              className="plover-onboarding__mockup-btn-primary"
              style={{ cursor: 'default' }}
            >
              Break into steps →
            </button>
          </div>
        </div>
      )}

      {slideIndex === 1 && (
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
          <div className="plover-onboarding__mockup-add-step" style={{ cursor: 'default' }}>
            + Add a step
          </div>
          <div className="plover-onboarding__mockup-footer">
            <span />
            <button
              type="button"
              className="plover-onboarding__mockup-btn-primary"
              style={{ cursor: 'default' }}
            >
              Looks right →
            </button>
          </div>
        </div>
      )}

      {slideIndex === 2 && (
        <div className="plover-onboarding__mockup-content">
          <div className="plover-onboarding__mockup-label">
            <span className="plover-onboarding__mockup-label-dot" />
            <span>Last step</span>
          </div>
          <h2
            className="plover-onboarding__mockup-h1"
            style={{ fontSize: '24px', marginBottom: '8px' }}
          >
            What's the next step?
          </h2>
          <div className="plover-onboarding__mockup-footer">
            <span />
            <button
              type="button"
              className="plover-onboarding__mockup-btn-primary"
              style={{ cursor: 'default' }}
            >
              Add step →
            </button>
          </div>
        </div>
      )}

      {slideIndex === 3 && (
        <div
          className="plover-onboarding__mockup-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <h2
            className="plover-onboarding__mockup-h1"
            style={{ fontSize: '24px', marginBottom: '8px' }}
          >
            That's it. Tick off steps as you go.
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              marginBottom: '24px',
              maxWidth: '280px',
            }}
          >
            Get to work. Tick off each step by hand when it's done.
          </p>
          <div
            className="plover-onboarding__pill-widget"
            style={{
              width: '100%',
              maxWidth: '320px',
              marginBottom: '24px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="plover-onboarding__pill-left">
              <span className="plover-onboarding__pill-pulse" />
              <span className="plover-onboarding__pill-title">Draft — methods</span>
            </div>
          </div>
          <div
            className="plover-onboarding__mockup-footer"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <button
              type="button"
              className="plover-onboarding__mockup-btn-primary"
              style={{ cursor: 'default' }}
            >
              Start working →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

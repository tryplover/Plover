interface GuidedSlideContentProps {
  guidedSlideIndex: number;
  appName: string;
}

export function GuidedSlideContent({ guidedSlideIndex, appName }: GuidedSlideContentProps) {
  if (guidedSlideIndex === 0) {
    return (
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
    );
  }

  if (guidedSlideIndex === 1) {
    return (
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
    );
  }

  if (guidedSlideIndex === 2) {
    return (
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
                <div className="plover-onboarding__mockup-app-name">Google Docs — Thesis draft</div>
                <div className="plover-onboarding__mockup-app-status">Active now • Chrome</div>
              </div>
            </div>
            <button
              type="button"
              className="plover-onboarding__mockup-app-watch-btn plover-onboarding__mockup-app-watch-btn--selected"
            >
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
                <div className="plover-onboarding__mockup-app-name">Notion — Research notes</div>
                <div className="plover-onboarding__mockup-app-status">Open • Notion</div>
              </div>
            </div>
            <button type="button" className="plover-onboarding__mockup-app-watch-btn">
              Watch
            </button>
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
            <button type="button" className="plover-onboarding__mockup-app-watch-btn">
              Watch
            </button>
          </div>
        </div>
        <div className="plover-onboarding__mockup-footer">
          <span />
          <button
            type="button"
            className="plover-onboarding__mockup-btn-primary"
            style={{ cursor: 'default' }}
          >
            Start tracking →
          </button>
        </div>
      </div>
    );
  }

  if (guidedSlideIndex === 3) {
    return (
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
          That's it. Plover's watching.
        </h2>
        <p
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            marginBottom: '24px',
            maxWidth: '280px',
          }}
        >
          Get to work — the bar fills as you go. Glance over whenever you like.
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
            <span className="plover-onboarding__pill-status">observing</span>
            <span className="plover-onboarding__pill-sep">•</span>
            <span className="plover-onboarding__pill-title">Draft — methods</span>
          </div>
          <span className="plover-onboarding__pill-pct">4%</span>
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
    );
  }

  return null;
}

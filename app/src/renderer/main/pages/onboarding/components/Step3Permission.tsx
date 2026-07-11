interface Step3PermissionProps {
  onBack: () => void;
  onNext: () => void;
}

export function Step3Permission({ onBack, onNext }: Step3PermissionProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-permission">
      <div className="plover-onboarding__centered">
        <div className="plover-onboarding__center-glow" />
        <div className="plover-onboarding__centered-content">
          <div
            className="plover-onboarding__widget-container"
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div
              className="plover-onboarding__mockup-window"
              style={{ width: '220px', padding: '16px' }}
            >
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '50%', marginBottom: '8px' }}
              />
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '80%', marginBottom: '8px' }}
              />
              <div
                className="plover-onboarding__skeleton"
                style={{ width: '60%', marginBottom: '16px' }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '42px',
                  borderRadius: '50%',
                  width: '42px',
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  margin: '0 auto',
                  fontSize: '18px',
                  boxShadow: '0 0 0 6px rgba(46, 125, 50, 0.1)',
                }}
              >
                👁
              </div>
            </div>
          </div>

          <h1 className="plover-onboarding__title--center">Now, let's turn it on.</h1>
          <p className="plover-onboarding__desc--center">
            Plover needs screen-recording permission to read your chosen window. macOS will ask you
            to confirm.
          </p>

          <div className="plover-onboarding__btn-row" style={{ justifyContent: 'center' }}>
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
            <button
              className="plover-onboarding__btn"
              onClick={onNext}
              data-testid="btn-grant-settings"
            >
              Open System Settings →
            </button>
          </div>
          <p className="plover-onboarding__disclaimer">You'll choose which window in the next step.</p>
        </div>
      </div>
    </section>
  );
}

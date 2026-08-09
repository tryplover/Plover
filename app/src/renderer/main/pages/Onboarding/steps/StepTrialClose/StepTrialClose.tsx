import { AuthPanel } from '../../../../../components/AuthPanel/AuthPanel';

interface StepTrialCloseProps {
  mode: 'signup' | 'signin';
  onToggleMode: () => void;
  onBack: () => void;
  onAuthSuccess: () => void;
  finishError: string | null;
}

export function StepTrialClose({
  mode,
  onToggleMode,
  onBack,
  onAuthSuccess,
  finishError,
}: StepTrialCloseProps) {
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
            Full Plover, free for 14 days. No credit card needed.
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
            <button className="plover-onboarding__btn-back" onClick={onBack}>
              Back
            </button>
          </div>
          <div
            style={{
              marginTop: '20px',
              maxWidth: '360px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <AuthPanel mode={mode} onSuccess={onAuthSuccess} />
            <button
              type="button"
              className="plover-onboarding__btn-secondary"
              onClick={onToggleMode}
              style={{
                display: 'block',
                marginTop: '12px',
                textAlign: 'center',
                width: '100%',
              }}
              data-testid="btn-trial-close-toggle-mode"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
          {finishError && (
            <p
              className="plover-onboarding__auth-status-msg plover-onboarding__auth-status-msg--error"
              style={{ textAlign: 'center', marginTop: '16px' }}
            >
              {finishError}
            </p>
          )}
          <p className="plover-onboarding__disclaimer">
            You can review your plan anytime in Settings.
          </p>
        </div>
      </div>
    </section>
  );
}

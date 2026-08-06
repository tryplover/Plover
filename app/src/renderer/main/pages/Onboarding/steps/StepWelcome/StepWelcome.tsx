import ploverLogo from '../../../../../plover-logo.png';
import ploverDemoVideo from '../../../../../Plover-Demo.mp4';
import { AuthPanel } from '../../../../../components/AuthPanel/AuthPanel';

interface StepWelcomeProps {
  showSignInPanel: boolean;
  onShowSignInPanel: () => void;
  onNext: () => void;
  onSignInSuccess: () => void;
}

export function StepWelcome({
  showSignInPanel,
  onShowSignInPanel,
  onNext,
  onSignInSuccess,
}: StepWelcomeProps) {
  return (
    <section className="plover-onboarding__slide" data-testid="step-welcome">
      <div className="plover-onboarding__split-left">
        <div className="plover-onboarding__brand">
          <img src={ploverLogo} className="plover-onboarding__brand-logo" alt="Plover Logo" />
          <span>Plover</span>
        </div>
        <h1 className="plover-onboarding__title">The Progress Bar That Works</h1>

        <div className="plover-onboarding__auth-container">
          <button
            type="button"
            className="plover-onboarding__btn"
            onClick={onNext}
            data-testid="btn-get-started"
          >
            Get Started →
          </button>
          <div style={{ marginTop: '20px' }}>
            {showSignInPanel ? (
              <AuthPanel mode="signin" onSuccess={onSignInSuccess} />
            ) : (
              <button
                type="button"
                className="plover-onboarding__btn-secondary"
                onClick={onShowSignInPanel}
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>

        <p className="plover-onboarding__disclaimer">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
      <div className="plover-onboarding__split-right">
        <div className="plover-onboarding__right-glow" />
        <div className="plover-onboarding__video-frame">
          <video
            src={ploverDemoVideo}
            autoPlay
            loop
            muted
            playsInline
            className="plover-onboarding__video"
          />
        </div>
      </div>
    </section>
  );
}

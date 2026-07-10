import { useState } from 'react';
import { motion, ploverDuration, ploverEasing } from '../lib/motion';
import './SignupScreen.css';

type State =
  | { kind: 'idle' }
  | { kind: 'opened-browser' }
  | { kind: 'error'; message: string };

export function SignupScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const startSignup = () => {
    setState({ kind: 'opened-browser' });
    window.api.signup
      .start()
      .then(() => window.api.signup.complete())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message });
      });
  };

  const heading = state.kind === 'error' ? 'Signup failed' : 'Sign in to Plover';
  const subhead =
    state.kind === 'error'
      ? state.message
      : state.kind === 'opened-browser'
        ? 'Complete sign-in in your browser. This window will close automatically.'
        : 'One-time setup so Plover can plan your goals with Gemini.';

  const buttonLabel =
    state.kind === 'error'
      ? 'Try again'
      : state.kind === 'opened-browser'
        ? 'Waiting for browser…'
        : 'Continue with Google';

  const buttonDisabled = state.kind === 'opened-browser';

  return (
    <div className="plover-signup">
      <motion.div
        className="plover-signup__card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ploverDuration.normal, ease: ploverEasing.soft }}
      >
        <h1 className="plover-signup__heading">{heading}</h1>
        <p className="plover-signup__subhead">{subhead}</p>
        <button
          type="button"
          className="plover-signup__button"
          onClick={startSignup}
          disabled={buttonDisabled}
        >
          {buttonLabel}
        </button>
      </motion.div>
    </div>
  );
}

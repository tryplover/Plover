import { useRef, useState } from 'react';
import './AuthPanel.css';

type AuthPanelStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'opened-browser' }
  | { kind: 'check-email' }
  | { kind: 'error'; message: string };

interface AuthPanelProps {
  mode: 'signin' | 'signup';
  onSuccess: () => void;
}

export function AuthPanel({ mode, onSuccess }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<AuthPanelStatus>({ kind: 'idle' });
  const googleRequestIdRef = useRef(0);

  const busy = status.kind === 'submitting' || status.kind === 'opened-browser';

  const handleGoogle = () => {
    const requestId = ++googleRequestIdRef.current;
    setStatus({ kind: 'opened-browser' });
    window.api.auth
      .signIn()
      .then(() => {
        if (googleRequestIdRef.current !== requestId) return;
        onSuccess();
      })
      .catch((err: unknown) => {
        if (googleRequestIdRef.current !== requestId) return;
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  };

  const handleCancelGoogle = () => {
    googleRequestIdRef.current += 1;
    setStatus({ kind: 'idle' });
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'submitting' });
    const request =
      mode === 'signup'
        ? window.api.auth.signUp(email, password)
        : window.api.auth.signInWithPassword(email, password);
    request
      .then((result) => {
        if ('needsEmailConfirmation' in result && result.needsEmailConfirmation) {
          setStatus({ kind: 'check-email' });
          return;
        }
        onSuccess();
      })
      .catch((err: unknown) => {
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  };

  if (status.kind === 'check-email') {
    return (
      <p className="plover-auth-panel__status-msg" data-testid="auth-check-email">
        Check your email to confirm your account, then sign in.
      </p>
    );
  }

  return (
    <div className="plover-auth-panel">
      <button
        type="button"
        className="plover-auth-panel__btn-google"
        onClick={handleGoogle}
        disabled={busy}
        data-testid="btn-auth-google"
      >
        {status.kind === 'opened-browser' ? 'Waiting for browser…' : 'Continue with Google'}
      </button>

      {status.kind === 'opened-browser' && (
        <button
          type="button"
          className="plover-auth-panel__btn-cancel"
          onClick={handleCancelGoogle}
          data-testid="btn-auth-google-cancel"
        >
          Cancel sign-in
        </button>
      )}

      <div className="plover-auth-panel__divider">
        <span>or</span>
      </div>

      <form onSubmit={handlePasswordSubmit} className="plover-auth-panel__form">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          className="plover-auth-panel__input"
          data-testid="input-auth-email"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className="plover-auth-panel__input"
          data-testid="input-auth-password"
        />
        <button
          type="submit"
          className="plover-auth-panel__submit"
          disabled={busy}
          data-testid="btn-auth-submit"
        >
          {status.kind === 'submitting'
            ? mode === 'signup'
              ? 'Creating account…'
              : 'Signing in…'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      {status.kind === 'error' && (
        <p className="plover-auth-panel__status-msg plover-auth-panel__status-msg--error">
          {status.message}
        </p>
      )}
    </div>
  );
}

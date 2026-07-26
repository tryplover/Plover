import { useRef, useState } from 'react';
import { Button } from './Button';

interface AccountStatus {
  signedIn: boolean;
  email: string | null;
}

interface AccountModalProps {
  status: AccountStatus;
  onClose: () => void;
  onStatusChange: (status: AccountStatus) => void;
}

type AccountModalState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'opened-browser' }
  | { kind: 'error'; message: string };

export function AccountModal({ status, onClose, onStatusChange }: AccountModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<AccountModalState>({ kind: 'idle' });
  const googleRequestIdRef = useRef(0);

  const busy = state.kind === 'submitting' || state.kind === 'opened-browser';

  const handleGoogle = () => {
    const requestId = ++googleRequestIdRef.current;
    setState({ kind: 'opened-browser' });
    window.api.auth
      .signIn()
      .then((result) => {
        if (googleRequestIdRef.current !== requestId) return;
        onStatusChange(result);
        onClose();
      })
      .catch((err: unknown) => {
        if (googleRequestIdRef.current !== requestId) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  };

  const handleCancelGoogle = () => {
    googleRequestIdRef.current += 1;
    setState({ kind: 'idle' });
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setState({ kind: 'submitting' });
    window.api.auth
      .signInWithPassword(email, password)
      .then((result) => {
        onStatusChange(result);
        onClose();
      })
      .catch((err: unknown) => {
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  };

  const handleSignOut = () => {
    setState({ kind: 'submitting' });
    window.api.auth
      .signOut()
      .then((result) => {
        onStatusChange(result);
        onClose();
      })
      .catch((err: unknown) => {
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  };

  return (
    <div className="plover-modal-backdrop" onClick={onClose}>
      <div
        className="plover-modal-content plover-account-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="plover-modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        {status.signedIn ? (
          <div className="plover-account-modal__panel" data-testid="account-modal-signed-in">
            <h2 className="plover-account-modal__title">Plover Account</h2>
            <p className="plover-account-modal__status-msg">Signed in as {status.email}</p>
            <Button
              variant="secondary"
              onClick={handleSignOut}
              disabled={state.kind === 'submitting'}
              data-testid="btn-account-sign-out"
            >
              {state.kind === 'submitting' ? 'Signing out…' : 'Sign out'}
            </Button>
            {state.kind === 'error' && (
              <p className="plover-account-modal__error">{state.message}</p>
            )}
          </div>
        ) : (
          <div className="plover-account-modal__panel" data-testid="account-modal-signed-out">
            <h2 className="plover-account-modal__title">Sign in to Plover</h2>

            <Button
              variant="secondary"
              onClick={handleGoogle}
              disabled={busy}
              className="plover-account-modal__google-btn"
              data-testid="btn-account-google"
            >
              {state.kind === 'opened-browser' ? 'Waiting for browser…' : 'Sign In with Google'}
            </Button>

            {state.kind === 'opened-browser' && (
              <button
                type="button"
                className="plover-account-modal__cancel"
                onClick={handleCancelGoogle}
                data-testid="btn-account-google-cancel"
              >
                Cancel sign-in
              </button>
            )}

            <div className="plover-account-modal__divider">
              <span>OR</span>
            </div>

            <form onSubmit={handlePasswordSubmit} className="plover-account-modal__form">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                className="plover-input"
                data-testid="input-account-email"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                className="plover-input"
                data-testid="input-account-password"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={busy}
                data-testid="btn-account-submit"
              >
                {state.kind === 'submitting' ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {state.kind === 'error' && (
              <p className="plover-account-modal__error">{state.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

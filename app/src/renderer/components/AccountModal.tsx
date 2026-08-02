import { useState } from 'react';
import { Button } from './Button/Button';
import { AuthPanel } from './AuthPanel/AuthPanel';

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
  { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string };

export function AccountModal({ status, onClose, onStatusChange }: AccountModalProps) {
  const [state, setState] = useState<AccountModalState>({ kind: 'idle' });
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const handleAuthSuccess = () => {
    window.api.auth
      .getStatus()
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
            <h2 className="plover-account-modal__title">
              {authMode === 'signup' ? 'Create your Plover account' : 'Sign in to Plover'}
            </h2>

            <AuthPanel mode={authMode} onSuccess={handleAuthSuccess} />

            <button
              type="button"
              className="plover-account-modal__mode-toggle"
              onClick={() => setAuthMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))}
              data-testid="btn-account-toggle-mode"
            >
              {authMode === 'signup'
                ? 'Already have an account? Sign in'
                : 'Need an account? Sign up'}
            </button>

            {state.kind === 'error' && (
              <p className="plover-account-modal__error">{state.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

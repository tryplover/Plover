import { Button } from '../../../../../components/Button/Button.js';

interface AuthStatus {
  signedIn: boolean;
  email: string | null;
}

interface AccountSectionProps {
  authStatus: AuthStatus;
  onPloverAccountToggle: () => void;
  googleConnected: boolean;
  onConnectGoogle: () => void;
}

export function AccountSection({
  authStatus,
  onPloverAccountToggle,
  googleConnected,
  onConnectGoogle,
}: AccountSectionProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--plover-surface)',
        borderRadius: 'var(--plover-radius-lg)',
        padding: '24px',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--plover-text)',
        }}
      >
        Account
      </h2>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Plover Account
          </p>
          {authStatus.signedIn && (
            <p
              style={{
                fontSize: '13px',
                color: 'var(--plover-text-muted)',
                marginTop: '4px',
              }}
            >
              Signed in as {authStatus.email}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {authStatus.signedIn && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--plover-text-muted)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--plover-mint)',
                }}
              />
              Connected
            </span>
          )}
          <Button
            variant={authStatus.signedIn ? 'secondary' : 'primary'}
            onClick={onPloverAccountToggle}
          >
            {authStatus.signedIn ? 'Sign out' : 'Sign in with Google'}
          </Button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>Google</p>
          {googleConnected && (
            <p
              style={{
                fontSize: '13px',
                color: 'var(--plover-text-muted)',
                marginTop: '4px',
              }}
            >
              Connect Google to enable Docs progress tracking.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {googleConnected && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--plover-text-muted)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--plover-mint)',
                }}
              />
              Connected
            </span>
          )}
          <Button variant={googleConnected ? 'secondary' : 'primary'} onClick={onConnectGoogle}>
            {googleConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
}

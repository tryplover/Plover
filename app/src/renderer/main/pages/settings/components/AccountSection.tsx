import { Button } from '../../../../components/Button.js';

interface AccountSectionProps {
  googleConnected: boolean;
  onConnectCalendar: () => void;
}

export function AccountSection({ googleConnected, onConnectCalendar }: AccountSectionProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--plover-text)' }}>
            Google Calendar
          </p>
          {googleConnected && (
            <p
              style={{
                fontSize: '13px',
                color: 'var(--plover-text-muted)',
                marginTop: '4px',
              }}
            >
              Connected as account
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
          <Button variant={googleConnected ? 'secondary' : 'primary'} onClick={onConnectCalendar}>
            {googleConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
}

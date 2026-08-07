import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--plover-bg)',
            color: 'var(--plover-text)',
            padding: '40px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: 'var(--plover-surface)',
              borderRadius: 'var(--plover-radius-lg)',
              padding: '32px',
              border: '1px solid var(--plover-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div>
              <h1
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '24px',
                  color: 'var(--plover-danger, #ef4444)',
                }}
              >
                Something went wrong
              </h1>
              <p style={{ margin: 0, color: 'var(--plover-text-muted)' }}>
                An unexpected error occurred in the application.
              </p>
            </div>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: 'var(--plover-bg)',
                  padding: '16px',
                  borderRadius: 'var(--plover-radius-md)',
                  overflowX: 'auto',
                  border: '1px solid var(--plover-border)',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: 'var(--plover-text-dim)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={this.handleReload}>
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

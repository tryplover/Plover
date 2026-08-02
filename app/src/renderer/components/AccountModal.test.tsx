// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AccountModal } from './AccountModal.js';

describe('AccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error mock window.api
    window.api = {
      auth: {
        signIn: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ signedIn: false, email: null }),
        getStatus: vi.fn(),
      },
    };
  });

  it('shows a sign-in form by default when signed out', () => {
    render(
      <AccountModal
        status={{ signedIn: false, email: null }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Sign in to Plover')).toBeInTheDocument();
    expect(screen.getByTestId('btn-auth-submit')).toHaveTextContent('Sign in');
  });

  it('toggles to a sign-up form and back', () => {
    render(
      <AccountModal
        status={{ signedIn: false, email: null }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-account-toggle-mode'));

    expect(screen.getByText('Create your Plover account')).toBeInTheDocument();
    expect(screen.getByTestId('btn-auth-submit')).toHaveTextContent('Create account');

    fireEvent.click(screen.getByTestId('btn-account-toggle-mode'));

    expect(screen.getByText('Sign in to Plover')).toBeInTheDocument();
  });

  it('creates a new account and reports the refreshed status', async () => {
    const onStatusChange = vi.fn();
    const onClose = vi.fn();
    window.api.auth.signUp = vi
      .fn()
      .mockResolvedValue({
        signedIn: true,
        email: 'new@example.com',
        needsEmailConfirmation: false,
      });
    window.api.auth.getStatus = vi
      .fn()
      .mockResolvedValue({ signedIn: true, email: 'new@example.com' });

    render(
      <AccountModal
        status={{ signedIn: false, email: null }}
        onClose={onClose}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(screen.getByTestId('btn-account-toggle-mode'));
    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'hunter2!' },
    });
    fireEvent.click(screen.getByTestId('btn-auth-submit'));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ signedIn: true, email: 'new@example.com' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the signed-in panel with a working sign-out button', async () => {
    const onStatusChange = vi.fn();
    const onClose = vi.fn();
    render(
      <AccountModal
        status={{ signedIn: true, email: 'jordan@example.com' }}
        onClose={onClose}
        onStatusChange={onStatusChange}
      />,
    );

    expect(screen.getByText('Signed in as jordan@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-account-sign-out'));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ signedIn: false, email: null });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Onboarding } from '../../../../src/renderer/main/pages/Onboarding';

describe('Onboarding', () => {
  const mockOnComplete = vi.fn();
  const mockSaveGoalAndTasks = vi.fn().mockResolvedValue({ goal: {}, tasks: [] });
  const mockRequestScreenRecording = vi.fn().mockResolvedValue('granted');
  const mockOpenScreenRecordingSettings = vi.fn().mockResolvedValue(undefined);

  const mockAuthSignIn = vi.fn().mockResolvedValue({ signedIn: true, email: 'jordan@example.com' });
  const mockAuthSignInWithPassword = vi
    .fn()
    .mockResolvedValue({ signedIn: true, email: 'jordan@example.com' });
  const mockAuthSignUp = vi.fn().mockResolvedValue({
    signedIn: true,
    email: 'jordan@example.com',
    needsEmailConfirmation: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'api', {
      value: {
        saveGoalAndTasks: mockSaveGoalAndTasks,
        requestScreenRecording: mockRequestScreenRecording,
        openScreenRecordingSettings: mockOpenScreenRecordingSettings,
        auth: {
          signIn: mockAuthSignIn,
          signInWithPassword: mockAuthSignInWithPassword,
          signUp: mockAuthSignUp,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('allows signing in via Google and completes onboarding directly', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    expect(screen.getByTestId('step-welcome')).toBeTruthy();
    const revealBtn = screen.getByRole('button', { name: 'Already have an account? Sign in' });
    fireEvent.click(revealBtn);

    const googleBtn = await screen.findByTestId('btn-auth-google');
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(mockAuthSignIn).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('allows signing in with email/password', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));

    fireEvent.change(await screen.findByTestId('input-auth-email'), {
      target: { value: 'jordan@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'hunter2!' },
    });
    fireEvent.click(screen.getByTestId('btn-auth-submit'));

    await waitFor(() => {
      expect(mockAuthSignInWithPassword).toHaveBeenCalledWith('jordan@example.com', 'hunter2!');
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('allows canceling a pending Google sign-in and ignores a stale result afterwards', async () => {
    let resolveSignIn: ((value: { signedIn: boolean; email: string }) => void) | undefined;
    mockAuthSignIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    render(<Onboarding onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));

    const googleBtn = await screen.findByTestId('btn-auth-google');
    fireEvent.click(googleBtn);

    const cancelBtn = await screen.findByTestId('btn-auth-google-cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('btn-auth-google-cancel')).toBeNull();
    expect((screen.getByTestId('btn-auth-google') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('input-auth-email') as HTMLInputElement).disabled).toBe(false);

    resolveSignIn?.({ signedIn: true, email: 'jordan@example.com' });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it('allows switching to sign-in mode at trial close to recover an already-created account', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByTestId('btn-get-started'));
    fireEvent.click(await screen.findByTestId('btn-usecase-continue'));
    fireEvent.click(await screen.findByTestId('btn-promise-continue'));
    fireEvent.click(await screen.findByTestId('btn-grant-settings'));
    fireEvent.click(await screen.findByTestId('btn-lets-go'));
    fireEvent.click(await screen.findByTestId('btn-break-steps'));
    fireEvent.click(await screen.findByTestId('btn-looks-right'));
    fireEvent.click(await screen.findByTestId('btn-start-tracking-mock'));
    fireEvent.click(await screen.findByTestId('btn-start-working'));

    expect(await screen.findByTestId('step-trial-close')).toBeTruthy();
    expect(screen.getByTestId('btn-auth-submit').textContent).toBe('Create account');

    fireEvent.click(screen.getByTestId('btn-trial-close-toggle-mode'));
    expect(screen.getByTestId('btn-auth-submit').textContent).toBe('Sign in');

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'jordan@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'hunter2!' },
    });
    fireEvent.click(screen.getByTestId('btn-auth-submit'));

    await waitFor(() => {
      expect(mockAuthSignInWithPassword).toHaveBeenCalledWith('jordan@example.com', 'hunter2!');
      expect(mockSaveGoalAndTasks).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('renders and walks through the 10-step wizard successfully', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    // Step 0: Welcome Screen
    expect(screen.getByTestId('step-welcome')).toBeTruthy();
    expect(screen.getByText('The Progress Bar That Works')).toBeTruthy();

    const getStartedBtn = screen.getByTestId('btn-get-started');
    fireEvent.click(getStartedBtn);

    // Step 1: Use-case Selection
    expect(await screen.findByTestId('step-usecase')).toBeTruthy();
    expect(screen.getByText('What tasks can Plover help you track?')).toBeTruthy();

    // Toggle a chip
    const studyChip = screen.getByText('Daily study sessions');
    fireEvent.click(studyChip);

    const usecaseContinueBtn = screen.getByTestId('btn-usecase-continue');
    fireEvent.click(usecaseContinueBtn);

    // Step 2: Promise Screen
    expect(await screen.findByTestId('step-promise')).toBeTruthy();
    expect(screen.getByText('Before we go further ...')).toBeTruthy();

    const promiseContinueBtn = screen.getByTestId('btn-promise-continue');
    fireEvent.click(promiseContinueBtn);

    // Step 3: Permission Screen
    expect(await screen.findByTestId('step-permission')).toBeTruthy();
    expect(screen.getByText("Now, let's turn it on.")).toBeTruthy();

    const grantSettingsBtn = screen.getByTestId('btn-grant-settings');
    fireEvent.click(grantSettingsBtn);

    // Step 4: Interstitial
    expect(await screen.findByTestId('step-interstitial')).toBeTruthy();
    expect(screen.getByText("Now let's start your first task.")).toBeTruthy();

    const letsGoBtn = screen.getByTestId('btn-lets-go');
    fireEvent.click(letsGoBtn);

    // Step 5: Guided - Name
    expect(await screen.findByTestId('step-guided-name')).toBeTruthy();
    expect(screen.getByText('What are you working on?')).toBeTruthy();

    const breakStepsBtn = screen.getByTestId('btn-break-steps');
    fireEvent.click(breakStepsBtn);

    // Step 6: Guided - Breakdown
    expect(await screen.findByTestId('step-guided-breakdown')).toBeTruthy();
    expect(screen.getByText('Outline the section structure')).toBeTruthy();

    const looksRightBtn = screen.getByTestId('btn-looks-right');
    fireEvent.click(looksRightBtn);

    // Step 7: Guided - Connect
    expect(await screen.findByTestId('step-guided-connect')).toBeTruthy();
    expect(screen.getByText('Which window should I watch?')).toBeTruthy();

    const startTrackingMockBtn = screen.getByTestId('btn-start-tracking-mock');
    fireEvent.click(startTrackingMockBtn);

    // Step 8: Guided - First progress
    expect(await screen.findByTestId('step-guided-progress')).toBeTruthy();
    expect(screen.getByText("That's it. Plover's watching now.")).toBeTruthy();

    const startWorkingBtn = screen.getByTestId('btn-start-working');
    fireEvent.click(startWorkingBtn);

    // Step 9: Trial Close
    expect(await screen.findByTestId('step-trial-close')).toBeTruthy();
    expect(screen.getByText('Your first two weeks are on us.')).toBeTruthy();

    const finishGoogleBtn = screen.getByTestId('btn-auth-google');
    fireEvent.click(finishGoogleBtn);

    await waitFor(() => {
      expect(mockAuthSignIn).toHaveBeenCalled();
      expect(mockSaveGoalAndTasks).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('allows backing navigation', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    // Step 0 -> Step 1
    fireEvent.click(screen.getByTestId('btn-get-started'));
    expect(await screen.findByTestId('step-usecase')).toBeTruthy();

    // Click Back -> Step 0
    const backBtn = screen.getByText('Back');
    fireEvent.click(backBtn);
    expect(await screen.findByTestId('step-welcome')).toBeTruthy();
  });
});

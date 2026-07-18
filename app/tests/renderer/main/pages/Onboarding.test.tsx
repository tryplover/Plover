// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Onboarding } from '../../../../src/renderer/main/pages/Onboarding';

describe('Onboarding', () => {
  const mockOnComplete = vi.fn();
  const mockSaveGoalAndTasks = vi.fn().mockResolvedValue({ goal: {}, tasks: [] });
  const mockRequestScreenRecording = vi.fn().mockResolvedValue('granted');
  const mockOpenScreenRecordingSettings = vi.fn().mockResolvedValue(undefined);

  const mockSignupStart = vi.fn().mockResolvedValue(undefined);
  const mockSignupComplete = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'api', {
      value: {
        saveGoalAndTasks: mockSaveGoalAndTasks,
        requestScreenRecording: mockRequestScreenRecording,
        openScreenRecordingSettings: mockOpenScreenRecordingSettings,
        signup: {
          start: mockSignupStart,
          complete: mockSignupComplete,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('allows signing in via Google and completes onboarding directly', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    expect(screen.getByTestId('step-welcome')).toBeTruthy();
    const continueWithGoogleBtn = screen.getByRole('button', { name: 'Continue with Google' });
    fireEvent.click(continueWithGoogleBtn);

    await waitFor(() => {
      expect(mockSignupStart).toHaveBeenCalled();
      expect(mockSignupComplete).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('renders and walks through the 10-step wizard successfully', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    // Step 0: Welcome Screen
    expect(screen.getByTestId('step-welcome')).toBeTruthy();
    expect(screen.getByText('See your progress as you actually work.')).toBeTruthy();

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

    const finishOnboardingBtn = screen.getByTestId('btn-finish-onboarding');
    fireEvent.click(finishOnboardingBtn);

    await waitFor(() => {
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

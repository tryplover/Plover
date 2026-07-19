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
  const mockAuthSignIn = vi.fn().mockResolvedValue(undefined);

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
        auth: {
          signIn: mockAuthSignIn,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('allows signing in via Google and completes onboarding directly', async () => {
    render(<Onboarding onComplete={mockOnComplete} />);

    expect(screen.getByTestId('step-welcome')).toBeTruthy();
    const signInBtn = screen.getByRole('button', { name: 'Already have an account? Sign in' });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(mockAuthSignIn).toHaveBeenCalled();
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

    // Step 5: Guided Task Walkthrough Carousel
    expect(await screen.findByTestId('step-guided-carousel')).toBeTruthy();

    // Slide 0: What are you working on?
    expect(screen.getByTestId('guided-slide-0')).toBeTruthy();
    expect(screen.getByText('What are you working on?')).toBeTruthy();

    // Navigate to Slide 1 using Right Arrow
    const nextArrow = screen.getByTestId('carousel-arrow-right');
    fireEvent.click(nextArrow);

    // Slide 1: Guided - Breakdown
    expect(screen.getByTestId('guided-slide-1')).toBeTruthy();
    expect(screen.getByText('Outline the section structure')).toBeTruthy();

    // Test Left Arrow navigation (back to Slide 0)
    const prevArrow = screen.getByTestId('carousel-arrow-left');
    fireEvent.click(prevArrow);
    expect(screen.getByTestId('guided-slide-0')).toBeTruthy();

    // Go back to Slide 1
    fireEvent.click(nextArrow);
    expect(screen.getByTestId('guided-slide-1')).toBeTruthy();

    // Test indicator dot navigation (jump to Slide 2)
    const indicator2 = screen.getByTestId('carousel-indicator-2');
    fireEvent.click(indicator2);
    expect(screen.getByTestId('guided-slide-2')).toBeTruthy();
    expect(screen.getByText('Which window should I watch?')).toBeTruthy();

    // Navigate to Slide 3 using Right Arrow
    fireEvent.click(nextArrow);

    // Slide 3: Guided - First progress
    expect(screen.getByTestId('guided-slide-3')).toBeTruthy();
    expect(screen.getByText("That's it. Plover's watching.")).toBeTruthy();

    // Proceed using the bottom Continue button
    const continueBtn = screen.getByTestId('btn-carousel-continue');
    fireEvent.click(continueBtn);

    // Step 9: Trial Close
    expect(await screen.findByTestId('step-trial-close')).toBeTruthy();
    expect(screen.getByText('Your first two weeks are on us.')).toBeTruthy();

    const finishOnboardingBtn = screen.getByTestId('btn-finish-onboarding');
    fireEvent.click(finishOnboardingBtn);

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

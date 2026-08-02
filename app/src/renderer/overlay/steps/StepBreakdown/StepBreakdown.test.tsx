// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepBreakdown } from './StepBreakdown.js';

describe('StepBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error mock window.api
    window.api = {
      proposeGoal: vi.fn().mockResolvedValue({
        goal: { title: 'Learn TypeScript' },
        subtasks: [
          { title: 'Read handbook', estimate_minutes: 120 },
          { title: 'Complete exercises', estimate_minutes: 60 },
        ],
      }),
      auth: {
        signIn: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        getStatus: vi.fn(),
      },
    };
  });

  it('accepts draft prop and renders decomposed plan', async () => {
    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={vi.fn()} variant="overlay" />);

    expect(screen.getByText('Plover is planning…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Learn TypeScript')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    const [i0, i1] = inputs;
    expect(i0).toHaveValue('Read handbook');
    expect(i1).toHaveValue('Complete exercises');
  });

  it('allows editing step titles', async () => {
    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={vi.fn()} variant="overlay" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read handbook')).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue('Read handbook');
    fireEvent.change(input, { target: { value: 'Read TS Handbook 2026' } });

    expect(screen.getByDisplayValue('Read TS Handbook 2026')).toBeInTheDocument();
  });

  it('allows adding a new step', async () => {
    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={vi.fn()} variant="overlay" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read handbook')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /\+ Add a step/i });
    fireEvent.click(addBtn);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(3);
  });

  it('allows deleting a step', async () => {
    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={vi.fn()} variant="overlay" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read handbook')).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /delete step/i });
    expect(deleteBtns).toHaveLength(2);

    const [btn0] = deleteBtns;
    expect(btn0).toBeDefined();
    if (btn0) {
      fireEvent.click(btn0);
    }

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(1);
    const [rem0] = inputs;
    expect(rem0).toHaveValue('Complete exercises');
  });

  it('submits updated plan onNext', async () => {
    const onNext = vi.fn();
    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={onNext} variant="overlay" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read handbook')).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue('Read handbook');
    fireEvent.change(input, { target: { value: 'Read TS Handbook 2026' } });

    const nextBtn = screen.getByRole('button', { name: /looks right/i });
    fireEvent.click(nextBtn);

    expect(onNext).toHaveBeenCalledWith({
      goal: { title: 'Learn TypeScript' },
      subtasks: [
        { title: 'Read TS Handbook 2026', estimate_minutes: 120 },
        { title: 'Complete exercises', estimate_minutes: 60 },
      ],
    });
  });

  it('shows an inline sign-in panel and retries after a not-signed-in error', async () => {
    const proposeGoal = vi
      .fn()
      .mockRejectedValueOnce(new Error('not signed in — user must sign in'))
      .mockResolvedValueOnce({
        goal: { title: 'Learn TypeScript' },
        subtasks: [{ title: 'Read handbook', estimate_minutes: 120 }],
      });
    window.api.proposeGoal = proposeGoal;
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ signedIn: true, email: 'jordan@example.com' });
    window.api.auth.signInWithPassword = signInWithPassword;

    const draft = { text: 'Learn TypeScript', frequency: 'one-off' as const };
    render(<StepBreakdown draft={draft} onBack={vi.fn()} onNext={vi.fn()} variant="overlay" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-auth-submit')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'jordan@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'hunter2!' },
    });
    fireEvent.click(screen.getByTestId('btn-auth-submit'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Read handbook')).toBeInTheDocument();
    });
    expect(proposeGoal).toHaveBeenCalledTimes(2);
  });
});

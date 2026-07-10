// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SignupScreen } from '../../../src/renderer/setup/SignupScreen';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let startDeferred: Deferred<void>;
let completeMock: ReturnType<typeof vi.fn>;
let startMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  startDeferred = defer<void>();
  startMock = vi.fn(() => startDeferred.promise);
  completeMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'api', {
    value: {
      signup: {
        start: startMock,
        complete: completeMock,
      },
    },
    writable: true,
    configurable: true,
  });
});

describe('SignupScreen', () => {
  it('initial render shows "Continue with Google" button', () => {
    render(<SignupScreen />);
    expect(screen.getByText('Sign in to Plover')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('changes to "Waiting for browser…" after click', () => {
    render(<SignupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(startMock).toHaveBeenCalledTimes(1);
    const button = screen.getByRole('button', { name: 'Waiting for browser…' });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls signup.complete after start resolves', async () => {
    render(<SignupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await act(async () => {
      startDeferred.resolve();
      await startDeferred.promise;
    });
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows "Signup failed" and "Try again" on rejection', async () => {
    render(<SignupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await act(async () => {
      startDeferred.reject(new Error('oauth denied'));
      await startDeferred.promise.catch(() => undefined);
    });
    await waitFor(() => {
      expect(screen.getByText('Signup failed')).toBeTruthy();
      expect(screen.getByText('oauth denied')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });
});

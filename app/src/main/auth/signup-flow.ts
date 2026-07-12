import { randomBytes } from 'node:crypto';
import { shell } from 'electron';
import { setPloverToken } from './plover-token.js';

const NONCE_TTL_MS = 10 * 60 * 1000;

interface Pending {
  state: string;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingSignups = new Map<string, Pending>();

function getBackendUrl(): string {
  try {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.PLOVER_BACKEND_URL;
    if (fromVite) return fromVite;
  } catch {
    // ignore — import.meta.env not defined in this runtime
  }
  return process.env.PLOVER_BACKEND_URL ?? 'http://localhost:3000';
}

function generateState(): string {
  return randomBytes(32).toString('base64url');
}

function clearPending(state: string): Pending | undefined {
  const p = pendingSignups.get(state);
  if (p) {
    clearTimeout(p.timer);
    pendingSignups.delete(state);
  }
  return p;
}

export function startSignup(): Promise<void> {
  for (const [state, pending] of pendingSignups) {
    clearTimeout(pending.timer);
    pendingSignups.delete(state);
    pending.reject(new Error('Signup superseded by a new signup attempt'));
  }

  const state = generateState();

  const promise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingSignups.delete(state)) {
        reject(new Error('Signup timed out'));
      }
    }, NONCE_TTL_MS);

    pendingSignups.set(state, { state, resolve, reject, timer });
  });

  const url = `${getBackendUrl()}/signup?state=${encodeURIComponent(state)}`;
  void shell.openExternal(url);

  return promise;
}

export function completeSignup(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (parsed.protocol !== 'plover:') return;

  const state = parsed.searchParams.get('state');
  const token = parsed.searchParams.get('token');

  if (!state || !token) return;

  const pending = clearPending(state);
  if (!pending) return;

  setPloverToken(token).then(
    () => pending.resolve(),
    (err: unknown) => pending.reject(err instanceof Error ? err : new Error(String(err))),
  );
}

export function _clearPendingForTests(): void {
  for (const [state, pending] of pendingSignups) {
    clearTimeout(pending.timer);
    pendingSignups.delete(state);
    pending.reject(new Error('Cleared for tests'));
  }
}

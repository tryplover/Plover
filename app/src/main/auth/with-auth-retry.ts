import { UnauthorizedError } from '../http/authed-fetch.js';
import { startSignup } from './signup-flow.js';

export async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      await startSignup();
      return await fn();
    }
    throw err;
  }
}

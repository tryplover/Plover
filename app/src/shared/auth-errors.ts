export const NOT_SIGNED_IN_MESSAGE = 'not signed in — user must sign in';

export function isNotSignedInError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(NOT_SIGNED_IN_MESSAGE);
}

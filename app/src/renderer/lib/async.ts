/**
 * Wraps an async function to catch errors and prevent unhandled promise rejections.
 * Currently it logs to console, but provides a single point to add UI notifications later.
 */
export function safeAsync<T extends unknown[]>(
  fn: (...args: T) => Promise<unknown>,
): (...args: T) => void {
  return (...args: T) => {
    fn(...args).catch((err) => {
      console.error('Unhandled promise rejection:', err);
    });
  };
}

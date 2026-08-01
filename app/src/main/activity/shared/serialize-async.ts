export function serializeAsync(onError?: (err: unknown) => void): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = tail.then(fn);
    tail = onError ? next.catch(onError) : next.catch(() => undefined);
    return next;
  };
}

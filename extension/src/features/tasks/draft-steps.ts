export function insertStepAfter<T>(steps: T[], index: number, step: T): T[] {
  return [...steps.slice(0, index + 1), step, ...steps.slice(index + 1)];
}

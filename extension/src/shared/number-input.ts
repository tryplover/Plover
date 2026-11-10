export function clampInput(raw: string, min: number, max: number): number {
  const n = Math.floor(Number(raw.trim()));
  if (raw.trim() === "" || !Number.isFinite(n) || n < min) return min;
  return Math.min(n, max);
}

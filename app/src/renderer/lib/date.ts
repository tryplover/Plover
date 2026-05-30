export function isToday(isoString?: string, now: Date = new Date()): boolean {
  if (!isoString) return false;
  const date = new Date(isoString);
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export const MIN_PANEL_HEIGHT = 200;
export const DEFAULT_PANEL_HEIGHT = 480;

export function panelHeight(
  content: number,
  viewportHeight: number,
  offset: number,
  margin: number,
): number {
  const max = Math.max(MIN_PANEL_HEIGHT, viewportHeight - offset - margin);
  return Math.min(Math.max(content, MIN_PANEL_HEIGHT), max);
}

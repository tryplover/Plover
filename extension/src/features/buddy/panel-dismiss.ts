export const PANEL_CLOSE_MESSAGE = "plover/panel-close";
export const PANEL_HEIGHT_MESSAGE = "plover/panel-height";

export function isCloseKey(key: string): boolean {
  return key === "Escape";
}

export function shouldCloseOnPointer(
  path: readonly EventTarget[],
  hostEl: EventTarget,
  iframeEl: EventTarget | null,
): boolean {
  return !path.includes(hostEl) && !(iframeEl && path.includes(iframeEl));
}

export function isPanelCloseMessage(
  data: unknown,
  source: unknown,
  frameWindow: unknown,
): boolean {
  if (!frameWindow || source !== frameWindow) return false;
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === PANEL_CLOSE_MESSAGE
  );
}

export function isPanelHeightMessage(
  data: unknown,
  source: unknown,
  frameWindow: unknown,
): data is { type: string; height: number } {
  if (!frameWindow || source !== frameWindow) return false;
  if (typeof data !== "object" || data === null) return false;
  const { type, height } = data as { type?: unknown; height?: unknown };
  return (
    type === PANEL_HEIGHT_MESSAGE &&
    typeof height === "number" &&
    Number.isFinite(height) &&
    height > 0
  );
}

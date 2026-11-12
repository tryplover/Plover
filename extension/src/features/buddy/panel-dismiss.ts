export const PANEL_CLOSE_MESSAGE = "plover/panel-close";

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

import { BrowserWindow } from 'electron';

export function handleOverlayResize(
  getOverlayWindow: () => BrowserWindow | null,
  height: number,
  width?: number,
) {
  const overlayWin = getOverlayWindow();
  if (overlayWin) {
    const bounds = overlayWin.getBounds();
    const newWidth = width ?? bounds.width;
    if (bounds.height !== height || bounds.width !== newWidth) {
      const newX = bounds.x - Math.round((newWidth - bounds.width) / 2);
      overlayWin.setBounds({
        x: newX,
        y: bounds.y,
        width: newWidth,
        height: height,
      });
    }
  }
}

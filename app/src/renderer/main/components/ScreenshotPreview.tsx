import { useEffect, useState } from 'react';

export function ScreenshotPreview({ id }: { id: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    void (async (): Promise<void> => {
      const result = await window.api.getScreenshot(id);
      setDataUrl(result?.dataUrl ?? null);
    })();
  }, [id]);
  if (!dataUrl) return <p className="screenshot-missing">Image unavailable.</p>;
  return <img src={dataUrl} alt={`Screenshot #${id}`} className="screenshot-preview" />;
}

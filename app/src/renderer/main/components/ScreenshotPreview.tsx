import { useEffect, useState } from 'react';

export function ScreenshotPreview({ id }: { id: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void (async (): Promise<void> => {
      const result = await window.api.getScreenshot(id);
      if (active) {
        setDataUrl(result?.dataUrl ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);
  if (loading) return <p className="screenshot-loading">Loading image…</p>;
  if (!dataUrl) return <p className="screenshot-missing">Image unavailable.</p>;
  return <img src={dataUrl} alt={`Screenshot #${id}`} className="screenshot-preview" />;
}

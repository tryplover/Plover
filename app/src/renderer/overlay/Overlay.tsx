import { useEffect, useRef, useState } from 'react';
import { SetupFlow } from './SetupFlow';

export function Overlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const variant =
    new URLSearchParams(window.location.search).get('variant') === 'window' ? 'window' : 'overlay';

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeWindow = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const height = Math.ceil(rect.height);
      const width = Math.ceil(rect.width);
      window.api.resizeOverlay(height, width).catch((err) => {
        console.error('Failed to resize overlay:', err);
      });
    };

    resizeWindow();

    const observer = new ResizeObserver(() => {
      resizeWindow();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.api.closeOverlay().catch((err) => {
          console.error('Failed to close overlay:', err);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return window.api.on('overlay:reset', () => {
      setResetCounter((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    if (variant === 'overlay') {
      const originalBg = document.body.style.background;
      document.body.style.background = 'transparent';
      return () => {
        document.body.style.background = originalBg;
      };
    }
    return undefined;
  }, [variant]);

  const overlayStyle =
    variant === 'overlay'
      ? {
          boxSizing: 'border-box' as const,
          width: '100%',
          padding: '16px',
          backgroundColor: 'rgba(20, 20, 22, 0.45)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          color: '#f5f5f7',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          overflow: 'hidden' as const,
        }
      : {
          boxSizing: 'border-box' as const,
          width: '100%',
          height: '100%',
          padding: '0',
          backgroundColor: 'transparent',
          color: '#f5f5f7',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          overflow: 'hidden' as const,
        };

  return (
    <div ref={containerRef} style={overlayStyle}>
      <SetupFlow key={resetCounter} variant={variant} />
    </div>
  );
}

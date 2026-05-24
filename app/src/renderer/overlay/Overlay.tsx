import { useEffect, useRef, useState } from 'react';
import { QuickAdd } from './QuickAdd';

export function Overlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resetCounter, setResetCounter] = useState(0);

  // Resize window to fit content height dynamically
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeWindow = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const height = Math.ceil(rect.height);
      window.api.resizeOverlay(height).catch((err) => {
        console.error('Failed to resize overlay:', err);
      });
    };

    // Initial resize
    resizeWindow();

    const observer = new ResizeObserver(() => {
      resizeWindow();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Listen to Escape key to close the window
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

  // Listen to overlay reset event from main process
  useEffect(() => {
    return window.api.on('overlay:reset', () => {
      setResetCounter((prev) => prev + 1);
    });
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '16px',
        backgroundColor: 'rgba(28, 28, 30, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        color: '#f5f5f7',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <QuickAdd key={resetCounter} />
    </div>
  );
}

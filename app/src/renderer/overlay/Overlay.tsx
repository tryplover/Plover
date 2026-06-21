import { useEffect, useRef, useState } from 'react';
import { QuickAdd } from './QuickAdd';

export function Overlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resetCounter, setResetCounter] = useState(0);

  // Resize window to fit content width and height dynamically
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
        width: 'fit-content',
        height: 'fit-content',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      <QuickAdd key={resetCounter} />
    </div>
  );
}

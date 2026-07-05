import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from '../lib/motion';
import { Collapsed } from './Collapsed';
import { Expanded } from './Expanded';
import { useCompanionState } from './useCompanionState';

export function Companion() {
  const view = useCompanionState();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetHeight = useRef<number>(0);

  const performResize = useCallback((height: number) => {
    targetHeight.current = height;

    const attempt = async (h: number, retryCount: number) => {
      if (targetHeight.current !== h) return;

      try {
        await window.api.companion.resize(h);
      } catch (err) {
        if (targetHeight.current === h && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 500;
          setTimeout(() => {
            void attempt(h, retryCount + 1);
          }, delay);
        } else {
          console.error(`Failed to resize companion to ${h}px after ${retryCount + 1} attempts:`, err);
        }
      }
    };

    void attempt(height, 0);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (container) {
        const h = Math.ceil(container.getBoundingClientRect().height);
        if (h > 0) {
          performResize(h);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [expanded, performResize]);

  return (
    <div ref={containerRef} className="plover-companion-root">
      <AnimatePresence mode="wait">
        {expanded ? (
          <Expanded key="exp" view={view} onCollapse={() => setExpanded(false)} />
        ) : (
          <Collapsed key="col" view={view} onExpand={() => setExpanded(true)} />
        )}
      </AnimatePresence>
    </div>
  );
}

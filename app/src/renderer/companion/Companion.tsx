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
  const isResizing = useRef<boolean>(false);

  const performResize = useCallback((height: number) => {
    targetHeight.current = height;
    if (isResizing.current) return;

    const runResizeLoop = async () => {
      isResizing.current = true;
      while (true) {
        const h = targetHeight.current;
        if (h <= 0) break;

        for (let retryCount = 0; retryCount < 3; retryCount++) {
          if (targetHeight.current !== h) break;

          try {
            await window.api.companion.resize(h);
            break;
          } catch (err) {
            if (targetHeight.current !== h) break;

            if (retryCount < 2) {
              const delay = Math.pow(2, retryCount) * 500;
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              console.error(`Failed to resize companion to ${h}px after ${retryCount + 1} attempts:`, err);
            }
          }
        }

        if (targetHeight.current === h) break;
      }
      isResizing.current = false;
    };

    void runResizeLoop();
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
    return () => {
      observer.disconnect();
      targetHeight.current = 0;
    };
  }, [performResize]);

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

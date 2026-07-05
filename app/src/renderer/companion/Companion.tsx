import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from '../lib/motion';
import { Collapsed } from './Collapsed';
import { Expanded } from './Expanded';
import { useCompanionState } from './useCompanionState';

export function Companion() {
  const view = useCompanionState();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(async () => {
      if (container) {
        const h = container.getBoundingClientRect().height;
        try {
          await window.api.companion.resize(Math.ceil(h));
        } catch (err) {
          console.error('Failed to resize companion:', err);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [expanded]);

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

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
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const h = containerRef.current!.getBoundingClientRect().height;
      window.api.companion.resize(Math.ceil(h)).catch(console.error);
    });
    observer.observe(containerRef.current);
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

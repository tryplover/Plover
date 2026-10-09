import { useEffect, useRef, useState } from 'react';
import { safeAsync } from '../lib/async';
import { AnimatePresence } from '../lib/motion';
import { Collapsed } from './Collapsed';
import { Expanded } from './Expanded';
import { useCompanionState } from './useCompanionState';

export function Companion() {
  const view = useCompanionState();
  const [expanded, setExpanded] = useState(false);
  // Matches SettingsRepo.getAll()'s default so there's no flash of the
  // larger "Full" layout before the async getSettings() call resolves.
  const [companionMode, setCompanionMode] = useState<'full' | 'compact'>('compact');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.background = 'transparent';
  }, []);

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((settings) => {
        if (active && settings.companionMode) {
          setCompanionMode(settings.companionMode);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [expanded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(
      safeAsync(async () => {
        if (container) {
          const rect = container.getBoundingClientRect();
          const h = rect.height;
          const w = rect.width;
          await window.api.companion.resize(Math.ceil(h), Math.ceil(w));
        }
      }),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [expanded, companionMode]);

  return (
    <div
      ref={containerRef}
      className={`plover-companion-root ${expanded ? 'is-expanded' : 'is-collapsed'} ${
        companionMode === 'compact' ? 'is-compact' : 'is-full'
      }`}
    >
      <AnimatePresence mode="wait">
        {expanded ? (
          <Expanded key="exp" view={view} onCollapse={() => setExpanded(false)} />
        ) : (
          <Collapsed
            key="col"
            view={view}
            onExpand={() => setExpanded(true)}
            companionMode={companionMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

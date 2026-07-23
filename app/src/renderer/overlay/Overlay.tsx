import { useEffect, useRef, useState } from 'react';
import { SetupFlow } from './SetupFlow';

export function Overlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const variant =
    new URLSearchParams(window.location.search).get('variant') === 'window' ? 'window' : 'overlay';

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    let active = true;
    window.api
      .getSettings()
      .then((settings) => {
        if (active && settings.theme) {
          setTheme(settings.theme);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeWindow = () => {
      const el = containerRef.current;
      if (!el) return;

      const child = el.firstElementChild;
      let contentHeight = 0;
      if (child && child.children.length > 0) {
        for (const c of child.children) {
          if (c) {
            contentHeight += c.getBoundingClientRect().height || c.scrollHeight;
          }
        }
        contentHeight += 24; // buffer for gaps/margins
      } else {
        contentHeight = el.scrollHeight;
      }

      // Add container's vertical padding (22px * 2) and border (1px * 2)
      const height = Math.ceil(contentHeight) + 46;
      const width = Math.ceil(el.getBoundingClientRect().width);

      window.api.resizeOverlay(height, width).catch((err) => {
        console.error('Failed to resize overlay:', err);
      });
    };

    resizeWindow();
    const raf = requestAnimationFrame(resizeWindow);

    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      resizeWindow();
    });
    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }

    return () => {
      cancelAnimationFrame(raf);
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
      const originalBodyBg = document.body.style.background;
      const originalHtmlBg = document.documentElement.style.background;

      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';

      const rootEl = document.getElementById('root');
      const originalRootBg = rootEl ? rootEl.style.background : '';
      if (rootEl) {
        rootEl.style.background = 'transparent';
      }

      return () => {
        document.body.style.background = originalBodyBg;
        document.documentElement.style.background = originalHtmlBg;
        if (rootEl) {
          rootEl.style.background = originalRootBg;
        }
      };
    }
    return undefined;
  }, [variant]);

  const overlayStyle =
    variant === 'overlay'
      ? {
          boxSizing: 'border-box' as const,
          width: '100%',
          height: 'fit-content',
          padding: '22px 24px',
          backgroundColor:
            theme === 'light' ? 'rgba(243, 238, 228, 0.85)' : 'rgba(20, 20, 22, 0.45)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '12px',
          border:
            theme === 'light'
              ? '1px solid rgba(36, 33, 28, 0.12)'
              : '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow:
            theme === 'light'
              ? '0 8px 32px 0 rgba(36, 33, 28, 0.15)'
              : '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          color: theme === 'light' ? '#24211c' : '#f5f5f7',
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
          color: theme === 'light' ? '#24211c' : '#f5f5f7',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          overflow: 'hidden' as const,
        };

  return (
    <div
      ref={containerRef}
      style={overlayStyle}
      className={theme === 'light' ? 'plover-shell--light' : 'plover-shell--dark'}
    >
      <SetupFlow key={resetCounter} variant={variant} />
    </div>
  );
}

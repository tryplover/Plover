import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { normalizeDomain } from "@/lib/blocking/domains";
import { getSettings, updateSettings } from "@/lib/storage";
import type { BuddyCorner, Settings } from "@/lib/types";
import { isBuddyVisible, nearestCorner } from "@/lib/visibility";
import { Buddy } from "@/ui/Buddy";
import { useBuddySnapshot } from "@/ui/useBuddySnapshot";
import "./buddy.css";

const MARGIN = 16;
const SIZE = 56;
const GAP = 8;
const MENU_HEIGHT = 28;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 480;
const DRAG_THRESHOLD = 4;
const CHECKIN_TEXT = "Which step did you finish?";

interface PanelFrame {
  show(corner: BuddyCorner): void;
  hide(): void;
}

function cornerStyle(corner: BuddyCorner): CSSProperties {
  return {
    alignItems: corner.endsWith("left") ? "flex-start" : "flex-end",
    [corner.startsWith("top") ? "top" : "bottom"]: MARGIN,
    [corner.endsWith("left") ? "left" : "right"]: MARGIN,
  };
}

function useSyncedSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void getSettings().then((s) => alive && setSettings(s));
    load();
    browser.storage.onChanged.addListener(load);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(load);
    };
  }, []);
  return settings;
}

function BuddyApp({ panel }: { panel: PanelFrame }) {
  const settings = useSyncedSettings();
  const [fullscreen, setFullscreen] = useState(
    () => document.fullscreenElement !== null,
  );

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!settings || fullscreen || !isBuddyVisible(location.href, settings))
    return null;
  return <BuddyView settings={settings} panel={panel} />;
}

function BuddyView({
  settings,
  panel,
}: {
  settings: Settings;
  panel: PanelFrame;
}) {
  const snap = useBuddySnapshot();
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const corner = settings.buddyCorner;

  useEffect(() => {
    if (open && !drag) panel.show(corner);
    else panel.hide();
  }, [open, drag, corner, panel]);
  useEffect(() => () => panel.hide(), [panel]);

  if (!snap) return null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerMove(e: PointerEvent) {
    const s = start.current;
    if (!s) return;
    if (
      !s.moved &&
      Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_THRESHOLD
    )
      return;
    s.moved = true;
    setDrag({ x: e.clientX - SIZE / 2, y: e.clientY - SIZE / 2 });
  }

  function onPointerUp(e: PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (s.moved) {
      setDrag(null);
      void updateSettings({
        buddyCorner: nearestCorner(
          e.clientX,
          e.clientY,
          window.innerWidth,
          window.innerHeight,
        ),
      });
    } else {
      setOpen((o) => !o);
    }
  }

  function onPointerCancel() {
    start.current = null;
    setDrag(null);
  }

  const host = normalizeDomain(location.hostname);
  const style: CSSProperties = drag
    ? { left: drag.x, top: drag.y }
    : cornerStyle(corner);
  const below = corner.startsWith("top");
  const bubble = snap.checkInPending ? CHECKIN_TEXT : snap.nudgeText;

  return (
    <div className="plover-buddy-wrap" style={style}>
      {open && !drag && (
        <div
          className={`plover-row plover-buddy-menu ${below ? "plover-below" : ""}`}
        >
          {host && (
            <button
              type="button"
              onClick={() =>
                void updateSettings({
                  hiddenSites: [...new Set([...settings.hiddenSites, host])],
                })
              }
            >
              Hide on this site
            </button>
          )}
          <button
            type="button"
            onClick={() => void updateSettings({ hideEverywhere: true })}
          >
            Hide everywhere
          </button>
        </div>
      )}
      {!open && !drag && bubble && (
        <button
          type="button"
          className={`plover-bubble ${below ? "plover-below" : ""}`}
          onClick={() => setOpen(true)}
        >
          {bubble}
        </button>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <Buddy state={snap.buddyState} />
      </div>
    </div>
  );
}

function placeFrame(wrapper: HTMLElement, corner: BuddyCorner): void {
  const offset = `${MARGIN + SIZE + GAP + MENU_HEIGHT + GAP}px`;
  const vertical = corner.startsWith("top") ? "top" : "bottom";
  const horizontal = corner.endsWith("left") ? "left" : "right";
  wrapper.style.top = "";
  wrapper.style.bottom = "";
  wrapper.style.left = "";
  wrapper.style.right = "";
  wrapper.style[vertical] = offset;
  wrapper.style[horizontal] = `${MARGIN}px`;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const frame = createIframeUi(ctx, {
      page: "/panel.html",
      position: "inline",
      anchor: "html",
      onMount: (wrapper, iframe) => {
        Object.assign(wrapper.style, {
          position: "fixed",
          zIndex: "2147483647",
          display: "none",
        });
        Object.assign(iframe.style, {
          width: `${PANEL_WIDTH}px`,
          height: `${PANEL_HEIGHT}px`,
          border: "0",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
          colorScheme: "normal",
          display: "block",
        });
      },
    });
    let mounted = false;
    const panel: PanelFrame = {
      show(corner) {
        if (!mounted) {
          frame.mount();
          mounted = true;
        }
        placeFrame(frame.wrapper, corner);
        frame.wrapper.style.display = "block";
      },
      hide() {
        frame.wrapper.style.display = "none";
      },
    };

    const ui = await createShadowRootUi(ctx, {
      name: "plover-buddy",
      position: "overlay",
      zIndex: 2147483647,
      mode: "closed",
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<BuddyApp panel={panel} />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
    ctx.onInvalidated(() => {
      ui.remove();
      frame.remove();
    });
  },
});

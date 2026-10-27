import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { normalizeDomain } from "@/lib/blocking/domains";
import { deriveBuddyState } from "@/lib/buddy-state";
import { browser } from "wxt/browser";
import { getSettings, updateSettings } from "@/lib/storage";
import type { BuddyCorner, Settings } from "@/lib/types";
import { isBuddyVisible, nearestCorner } from "@/lib/visibility";
import { Buddy } from "@/ui/Buddy";
import { Panel } from "@/ui/Panel";
import { useExtensionState } from "@/ui/useExtensionState";
import "./buddy.css";

const MARGIN = 16;
const SIZE = 56;
const DRAG_THRESHOLD = 4;

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

function BuddyApp() {
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
  return <BuddyView />;
}

function BuddyView() {
  const state = useExtensionState("port");
  const { local, settings, now, ready } = state;
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  if (!ready) return null;

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
    : cornerStyle(settings.buddyCorner);
  const panelBelow = settings.buddyCorner.startsWith("top");

  return (
    <div className="plover-buddy-wrap" style={style}>
      {open && !drag && (
        <div
          className={`plover-buddy-panel ${panelBelow ? "plover-below" : "plover-above"}`}
        >
          <Panel surface="buddy" state={state} />
          <div className="plover-row plover-buddy-menu">
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
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <Buddy state={deriveBuddyState(local, now)} />
      </div>
    </div>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "plover-buddy",
      position: "overlay",
      zIndex: 2147483647,
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<BuddyApp />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  },
});

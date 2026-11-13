import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { normalizeDomain } from "@/features/blocking/domains";
import {
  isCloseKey,
  isPanelCloseMessage,
  isPanelHeightMessage,
  shouldCloseOnPointer,
} from "@/features/buddy/panel-dismiss";
import { isBuddyVisible, nearestCorner } from "@/features/buddy/visibility";
import { updateSettings } from "@/shared/storage";
import type { BuddyCorner, Settings } from "@/shared/types";
import { Buddy } from "@/ui/components/Buddy";
import { useBuddySnapshot } from "@/ui/hooks/useBuddySnapshot";
import { BuddyClock } from "./BuddyClock";
import { BUDDY_HEIGHT, BUDDY_WIDTH, MARGIN } from "./layout";
import type { PanelFrame } from "./panel-frame";
import { useSyncedSettings } from "./use-synced-settings";

const DRAG_THRESHOLD = 4;
const CHECKIN_TEXT = "Which step did you finish?";

function cornerStyle(corner: BuddyCorner): CSSProperties {
  return {
    alignItems: corner.endsWith("left") ? "flex-start" : "flex-end",
    [corner.startsWith("top") ? "top" : "bottom"]: MARGIN,
    [corner.endsWith("left") ? "left" : "right"]: MARGIN,
  };
}

export function BuddyApp({
  panel,
  hostEl,
}: {
  panel: PanelFrame;
  hostEl: HTMLElement;
}) {
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
  return <BuddyView settings={settings} panel={panel} hostEl={hostEl} />;
}

function BuddyView({
  settings,
  panel,
  hostEl,
}: {
  settings: Settings;
  panel: PanelFrame;
  hostEl: HTMLElement;
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

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (isCloseKey(e.key)) close();
    };
    const onPointer = (e: globalThis.PointerEvent) => {
      if (shouldCloseOnPointer(e.composedPath(), hostEl, panel.frameElement()))
        close();
    };
    const onMessage = (e: MessageEvent) => {
      const frameWindow = panel.frameWindow();
      if (isPanelCloseMessage(e.data, e.source, frameWindow)) close();
      else if (isPanelHeightMessage(e.data, e.source, frameWindow))
        panel.setContentHeight(e.data.height);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("message", onMessage);
    };
  }, [open, hostEl, panel]);

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
    setDrag({
      x: e.clientX - BUDDY_WIDTH / 2,
      y: e.clientY - BUDDY_HEIGHT / 2,
    });
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
    <div
      className="plover-buddy-wrap"
      data-theme={settings.theme === "system" ? undefined : settings.theme}
      style={style}
    >
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
        <div className="plover-buddy-figure">
          <Buddy state={snap.buddyState} />
          {snap.clock && !drag && <BuddyClock clock={snap.clock} />}
        </div>
      </div>
    </div>
  );
}

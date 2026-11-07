import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { BuddyCorner } from "@/shared/types";
import { BUDDY_HEIGHT, GAP, MARGIN, MENU_HEIGHT } from "./layout";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 480;

export interface PanelFrame {
  show(corner: BuddyCorner): void;
  hide(): void;
}

function placeFrame(wrapper: HTMLElement, corner: BuddyCorner): void {
  const offset = `${MARGIN + BUDDY_HEIGHT + GAP + MENU_HEIGHT + GAP}px`;
  const vertical = corner.startsWith("top") ? "top" : "bottom";
  const horizontal = corner.endsWith("left") ? "left" : "right";
  wrapper.style.top = "";
  wrapper.style.bottom = "";
  wrapper.style.left = "";
  wrapper.style.right = "";
  wrapper.style[vertical] = offset;
  wrapper.style[horizontal] = `${MARGIN}px`;
}

export function createPanelFrame(
  ctx: ContentScriptContext,
): PanelFrame & { remove(): void } {
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
  return {
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
    remove() {
      frame.remove();
      mounted = false;
    },
  };
}

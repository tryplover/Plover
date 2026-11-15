import type { ContentScriptContext } from "wxt/utils/content-script-context";
import type { BuddyCorner, BuddySize } from "@/shared/types";
import {
  DEFAULT_PANEL_HEIGHT,
  panelHeight,
} from "@/features/buddy/panel-height";
import { panelOffset } from "@/features/buddy/size";
import { GAP, MARGIN, MENU_HEIGHT } from "./layout";

const PANEL_WIDTH = 320;

export interface PanelFrame {
  show(corner: BuddyCorner, size: BuddySize): void;
  hide(): void;
  setContentHeight(px: number): void;
  frameWindow(): Window | null;
  frameElement(): HTMLIFrameElement | null;
}

function placeFrame(
  wrapper: HTMLElement,
  corner: BuddyCorner,
  offset: number,
): void {
  const vertical = corner.startsWith("top") ? "top" : "bottom";
  const horizontal = corner.endsWith("left") ? "left" : "right";
  wrapper.style.top = "";
  wrapper.style.bottom = "";
  wrapper.style.left = "";
  wrapper.style.right = "";
  wrapper.style[vertical] = `${offset}px`;
  wrapper.style[horizontal] = `${MARGIN}px`;
}

function fit(content: number, offset: number): number {
  return panelHeight(content, window.innerHeight, offset, MARGIN);
}

export function createPanelFrame(
  ctx: ContentScriptContext,
): PanelFrame & { remove(): void } {
  let offset = panelOffset("medium", MARGIN, GAP, MENU_HEIGHT);
  let content = DEFAULT_PANEL_HEIGHT;
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
        height: `${fit(DEFAULT_PANEL_HEIGHT, offset)}px`,
        border: "0",
        borderRadius: "12px",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
        colorScheme: "normal",
        display: "block",
      });
    },
  });
  let mounted = false;
  const apply = () => {
    frame.iframe.style.height = `${fit(content, offset)}px`;
  };
  window.addEventListener("resize", apply);
  return {
    show(corner, size) {
      if (!mounted) {
        frame.mount();
        mounted = true;
      }
      offset = panelOffset(size, MARGIN, GAP, MENU_HEIGHT);
      apply();
      placeFrame(frame.wrapper, corner, offset);
      frame.wrapper.style.display = "block";
    },
    hide() {
      frame.wrapper.style.display = "none";
    },
    setContentHeight(px) {
      content = px;
      apply();
    },
    frameWindow() {
      return mounted ? frame.iframe.contentWindow : null;
    },
    frameElement() {
      return mounted ? frame.iframe : null;
    },
    remove() {
      window.removeEventListener("resize", apply);
      frame.remove();
      mounted = false;
    },
  };
}

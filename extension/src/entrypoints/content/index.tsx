import { createRoot } from "react-dom/client";
import { BuddyApp } from "./BuddyView";
import { createPanelFrame } from "./panel-frame";
import "./buddy.css";

export default defineContentScript({
  registration: "runtime",
  cssInjectionMode: "ui",
  async main(ctx) {
    const panel = createPanelFrame(ctx);

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
      panel.remove();
    });
  },
});

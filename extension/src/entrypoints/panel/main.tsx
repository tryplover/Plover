import { createRoot } from "react-dom/client";
import {
  PANEL_CLOSE_MESSAGE,
  PANEL_HEIGHT_MESSAGE,
  isCloseKey,
} from "@/features/buddy/panel-dismiss";
import { Panel } from "@/ui/components/Panel";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./panel.css";

applyStoredTheme();
window.addEventListener("keydown", (e) => {
  if (isCloseKey(e.key) && window.parent !== window)
    window.parent.postMessage({ type: PANEL_CLOSE_MESSAGE }, "*");
});
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Panel surface="buddy" />);
  if (window.parent !== window) {
    const report = () =>
      window.parent.postMessage(
        {
          type: PANEL_HEIGHT_MESSAGE,
          height: Math.ceil(root.getBoundingClientRect().height),
        },
        "*",
      );
    new ResizeObserver(report).observe(root);
    report();
  }
}

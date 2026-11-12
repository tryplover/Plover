import { createRoot } from "react-dom/client";
import {
  PANEL_CLOSE_MESSAGE,
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
}

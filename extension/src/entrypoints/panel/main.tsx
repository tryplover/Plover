import { createRoot } from "react-dom/client";
import { Panel } from "@/ui/components/Panel";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./panel.css";

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Panel surface="buddy" />);
}

import { createRoot } from "react-dom/client";
import { Panel } from "@/ui/components/Panel";
import "./panel.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Panel surface="buddy" />);
}

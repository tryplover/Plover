import { createRoot } from "react-dom/client";
import { Panel } from "@/ui/components/Panel";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Panel surface="popup" />);
}

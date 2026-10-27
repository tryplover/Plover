import type { UserManifest } from "wxt";

export const manifest = {
  name: "Plover",
  description: "A cute desktop work buddy for the browser.",
  permissions: [
    "storage",
    "alarms",
    "declarativeNetRequest",
    "identity",
    "notifications",
    "tabs",
  ],
  host_permissions: ["<all_urls>"],
  commands: {
    _execute_action: {
      suggested_key: { default: "Alt+Shift+P" },
      description: "Open Plover",
    },
  },
  web_accessible_resources: [
    { resources: ["blocked.html"], matches: ["<all_urls>"] },
    {
      resources: ["panel.html"],
      matches: ["<all_urls>"],
      use_dynamic_url: true,
    },
  ],
} satisfies UserManifest;

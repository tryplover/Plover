import type { UserManifest } from "wxt";

export const manifest = {
  name: "Plover: Cute Pomodoro Timer, Site Blocker & Focus Buddy",
  short_name: "Plover",
  description:
    "Work next to a cute buddy, not alone. Plover is a little bird that acts as your Pomodoro timer, site blocker and task planner.",
  permissions: [
    "storage",
    "alarms",
    "activeTab",
    "declarativeNetRequest",
    "identity",
    "notifications",
    "scripting",
  ],
  optional_host_permissions: ["<all_urls>"],
  commands: {
    _execute_action: {
      suggested_key: { default: "Alt+Shift+O" },
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
    {
      resources: ["content-scripts/content.css"],
      matches: ["<all_urls>"],
      use_dynamic_url: true,
    },
  ],
} satisfies UserManifest;

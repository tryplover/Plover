import { browser } from "wxt/browser";
import type { Command } from "@/lib/messages";
import { registerBadge } from "@/background/badge";
import { dispatch } from "@/background/controller";
import { registerTaskHandlers } from "@/background/tasks";
import { onTimerEvent, registerTimerHandlers } from "@/background/timer";

const PLACEHOLDER_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export default defineBackground(() => {
  registerTimerHandlers();
  registerTaskHandlers();
  registerBadge();

  onTimerEvent(async (e) => {
    if (e.type !== "work-block-completed") return;
    await browser.notifications.create("checkin", {
      type: "basic",
      iconUrl: PLACEHOLDER_ICON,
      title: "Which step did you finish?",
      message: "Open Plover to check in.",
    });
  });

  browser.runtime.onMessage.addListener((message: Command) =>
    dispatch(message),
  );
});

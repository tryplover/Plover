import { browser } from "wxt/browser";
import { isCommand } from "@/lib/messages";
import { registerAuthHandlers } from "@/background/auth";
import { registerCalendarHandlers } from "@/background/calendar";
import { registerBadge } from "@/background/badge";
import { registerFocusHandlers } from "@/background/focus";
import { dispatch } from "@/background/controller";
import { registerTaskHandlers } from "@/background/tasks";
import { enqueue } from "@/background/queue";
import {
  onTimerEvent,
  reconcileTimer,
  registerTimerHandlers,
} from "@/background/timer";

const PLACEHOLDER_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export default defineBackground(() => {
  registerTimerHandlers();
  registerTaskHandlers();
  registerFocusHandlers();
  registerAuthHandlers();
  registerCalendarHandlers();
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

  browser.runtime.onStartup.addListener(() => void enqueue(reconcileTimer));
  browser.runtime.onInstalled.addListener(() => void enqueue(reconcileTimer));

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCommand(message)) return false;
    void dispatch(message).then(sendResponse);
    return true;
  });
});

import { browser } from "wxt/browser";
import { isCommand } from "@/lib/messages";
import { registerAuthHandlers } from "@/background/auth";
import { registerCalendarHandlers } from "@/background/calendar";
import { registerBadge } from "@/background/badge";
import { registerFocusHandlers } from "@/background/focus";
import { dispatch } from "@/background/controller";
import { registerStatePort } from "@/background/state-port";
import { registerTaskHandlers } from "@/background/tasks";
import { reconcile } from "@/background/reconcile";
import {
  notifyCheckIn,
  onTimerEvent,
  registerTimerHandlers,
} from "@/background/timer";

export default defineBackground(() => {
  browser.storage.local
    .setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
    .catch((e: unknown) => console.error("setAccessLevel failed", e));
  registerStatePort();
  registerTimerHandlers();
  registerTaskHandlers();
  registerFocusHandlers();
  registerAuthHandlers();
  registerCalendarHandlers();
  registerBadge();

  onTimerEvent(async (e) => {
    if (e.type !== "work-block-completed") return;
    await notifyCheckIn();
  });

  browser.runtime.onStartup.addListener(() => void reconcile());
  browser.runtime.onInstalled.addListener(() => void reconcile());

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCommand(message)) return false;
    void dispatch(message).then(sendResponse);
    return true;
  });
});

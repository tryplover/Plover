import { browser } from "wxt/browser";
import { isCommand } from "@/shared/messages";
import { registerAuthHandlers } from "@/features/auth/worker";
import { registerCalendarHandlers } from "@/features/calendar/worker";
import { openWelcome, registerSiteAccess } from "@/features/site-access/worker";
import { registerBadge } from "@/features/timer/badge";
import { registerFocusHandlers } from "@/features/focus/worker";
import { dispatch } from "@/worker/controller";
import { registerStatePort } from "@/worker/state-port";
import { registerTaskHandlers } from "@/features/tasks/worker";
import { reconcile } from "@/worker/reconcile";
import {
  notifyCheckIn,
  onTimerEvent,
  registerTimerHandlers,
} from "@/features/timer/worker";

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
  registerSiteAccess();
  registerBadge();

  onTimerEvent(async (e) => {
    if (e.type !== "work-block-completed") return;
    await notifyCheckIn();
  });

  browser.runtime.onStartup.addListener(() => void reconcile());
  browser.runtime.onInstalled.addListener(({ reason }) => {
    void reconcile();
    if (reason === "install") void openWelcome();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCommand(message)) return false;
    void dispatch(message).then(sendResponse);
    return true;
  });
});

import { browser } from "wxt/browser";
import { isCommand } from "@/shared/messages";
import {
  isTrustedWebsiteSender,
  parseExternalMessage,
} from "@/features/auth/handoff";
import { getLocal } from "@/shared/storage";
import { registerBuddyHandlers } from "@/features/buddy/worker";
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
  registerBuddyHandlers();
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

  browser.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
      if (!isTrustedWebsiteSender(sender, import.meta.env.DEV)) return false;
      const parsed = parseExternalMessage(message);
      if (!parsed) return false;
      if (parsed.type === "ping") {
        void (async () =>
          sendResponse({
            ok: true,
            signedIn: !(await getLocal("needsSignIn")),
            version: browser.runtime.getManifest().version,
          }))();
      } else {
        void dispatch({
          type: "auth/handoff",
          tokenHash: parsed.tokenHash,
        }).then(sendResponse);
      }
      return true;
    },
  );
});

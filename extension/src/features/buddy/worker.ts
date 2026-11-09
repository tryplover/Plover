import { browser } from "wxt/browser";
import {
  CHECK_PERIOD_MIN,
  answerInvite,
  inviteDue,
  inviteExpired,
  lastActivityAt,
  localDay,
  type InviteInput,
  type InviteTrigger,
} from "@/features/buddy/invite";
import { onTimerEvent } from "@/features/timer/worker";
import { getLocal, getSettings, setLocal } from "@/shared/storage";
import type { InviteState } from "@/shared/types";
import { onAlarm } from "@/worker/alarms";
import { registerHandler } from "@/worker/controller";

const INVITE_ALARM = "invite-check";

export const NUDGE_VISIBLE_MS = 60_000;

// Read-modify-write of `transient`: call only from inside the command queue.
export async function showNudge(text: string, now = Date.now()): Promise<void> {
  const transient = await getLocal("transient");
  await setLocal({
    transient: {
      ...transient,
      nudgeText: text,
      nudgeUntil: now + NUDGE_VISIBLE_MS,
    },
  });
}

async function inviteInput(now: number): Promise<InviteInput> {
  const [settings, needsSignIn, timer, invite, transient, sessions, started] =
    await Promise.all([
      getSettings(),
      getLocal("needsSignIn"),
      getLocal("timer"),
      getLocal("invite"),
      getLocal("transient"),
      getLocal("sessions"),
      getLocal("phaseStartedAt"),
    ]);
  return {
    now,
    askToStart: settings.askToStart,
    hideEverywhere: settings.hideEverywhere,
    signedIn: !needsSignIn,
    timerIdle: timer.phase === "idle",
    invite,
    inviteSince: transient.inviteSince,
    lastActivityAt: lastActivityAt(sessions, started),
  };
}

async function setInviteSince(inviteSince: number): Promise<void> {
  await setLocal({
    transient: { ...(await getLocal("transient")), inviteSince },
  });
}

async function patchInvite(patch: Partial<InviteState>): Promise<void> {
  await setLocal({ invite: { ...(await getLocal("invite")), ...patch } });
}

// Read-modify-write: call only from inside the command queue.
export async function checkInvite(
  trigger: InviteTrigger,
  now = Date.now(),
): Promise<void> {
  const input = await inviteInput(now);
  if (!inviteDue(input, trigger)) return;
  await setInviteSince(now);
  await patchInvite({ lastDay: localDay(now), lastAt: now });
}

async function onInviteAlarm(now = Date.now()): Promise<void> {
  const { inviteSince } = await getLocal("transient");
  if (inviteExpired(inviteSince, now)) {
    await setInviteSince(0);
    await patchInvite({ declinedUntil: answerInvite("later", now, 0) });
    return;
  }
  await checkInvite("afterStop", now);
  await checkInvite("idle", now);
}

export async function reconcileInvite(): Promise<void> {
  if (await browser.alarms.get(INVITE_ALARM)) return;
  await browser.alarms.create(INVITE_ALARM, {
    periodInMinutes: CHECK_PERIOD_MIN,
  });
}

export function registerBuddyHandlers(): void {
  registerHandler("invite/answer", async ({ choice }) => {
    const now = Date.now();
    const invite = await getLocal("invite");
    await setInviteSince(0);
    await patchInvite({
      declinedUntil: answerInvite(choice, now, invite.declinedUntil),
    });
    return { ok: true };
  });

  onAlarm(INVITE_ALARM, () => onInviteAlarm());

  onTimerEvent(async (e) => {
    if (e.type === "stopped") await patchInvite({ stoppedAt: Date.now() });
    else if (e.type === "phase-started") {
      await patchInvite({ stoppedAt: 0 });
      await setInviteSince(0);
    }
  });
}

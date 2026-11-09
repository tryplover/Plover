import type { LocalState } from "@/shared/types";

const MIN = 60_000;
export const AFTER_STOP_MS = 10 * MIN;
export const IDLE_MS = 45 * MIN;
export const LATER_MS = 30 * MIN;
export const INVITE_TTL_MS = 30 * MIN;
export const CHECK_PERIOD_MIN = 5;

export type InviteTrigger = "day" | "afterStop" | "idle";
export type InviteChoice = "start" | "later" | "notToday";

export interface InviteInput {
  now: number;
  askToStart: boolean;
  hideEverywhere: boolean;
  signedIn: boolean;
  timerIdle: boolean;
  invite: LocalState["invite"];
  inviteSince: number;
  lastActivityAt: number;
}

export function localDay(nowMs: number): string {
  const d = new Date(nowMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function nextLocalMidnight(nowMs: number): number {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function lastActivityAt(
  sessions: LocalState["sessions"],
  phaseStartedAt: number | null,
): number {
  return Math.max(0, phaseStartedAt ?? 0, ...sessions.map((s) => s.endedAt));
}

export function inviteDue(input: InviteInput, trigger: InviteTrigger): boolean {
  const { now, invite } = input;
  if (
    !input.askToStart ||
    input.hideEverywhere ||
    !input.signedIn ||
    !input.timerIdle ||
    input.inviteSince > 0 ||
    now < invite.declinedUntil
  )
    return false;
  switch (trigger) {
    case "day":
      return invite.lastDay !== localDay(now);
    case "afterStop":
      return invite.stoppedAt > 0 && now - invite.stoppedAt >= AFTER_STOP_MS;
    case "idle":
      return (
        now - input.lastActivityAt >= IDLE_MS && now - invite.lastAt >= IDLE_MS
      );
  }
}

export function inviteExpired(inviteSince: number, now: number): boolean {
  return inviteSince > 0 && now - inviteSince >= INVITE_TTL_MS;
}

export function answerInvite(
  choice: InviteChoice,
  now: number,
  declinedUntil: number,
): number {
  if (choice === "later") return now + LATER_MS;
  if (choice === "notToday") return nextLocalMidnight(now);
  return declinedUntil;
}

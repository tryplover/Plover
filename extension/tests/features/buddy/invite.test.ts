import { describe, expect, it } from "vitest";
import {
  AFTER_STOP_MS,
  CHECK_PERIOD_MIN,
  IDLE_MS,
  INVITE_TTL_MS,
  LATER_MS,
  answerInvite,
  inviteDue,
  inviteExpired,
  lastActivityAt,
  localDay,
  nextLocalMidnight,
  type InviteInput,
} from "@/features/buddy/invite";

const MIN = 60_000;
const NOON = new Date(2026, 10, 9, 12, 0, 0).getTime();

const base: InviteInput = {
  now: NOON,
  askToStart: true,
  hideEverywhere: false,
  signedIn: true,
  timerIdle: true,
  invite: { declinedUntil: 0, lastDay: "2026-11-09", lastAt: 0, stoppedAt: 0 },
  inviteSince: 0,
  lastActivityAt: NOON,
};
const withInvite = (patch: Partial<InviteInput["invite"]>): InviteInput => ({
  ...base,
  invite: { ...base.invite, ...patch },
});

describe("constants", () => {
  it("match the product decisions", () => {
    expect(AFTER_STOP_MS).toBe(10 * MIN);
    expect(IDLE_MS).toBe(45 * MIN);
    expect(LATER_MS).toBe(30 * MIN);
    expect(INVITE_TTL_MS).toBe(30 * MIN);
    expect(CHECK_PERIOD_MIN).toBe(5);
  });
});

describe("localDay / nextLocalMidnight", () => {
  it("formats the local date", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
    expect(localDay(new Date(2026, 0, 6, 0, 0).getTime())).toBe("2026-01-06");
  });

  it("rolls over at local midnight", () => {
    const midnight = new Date(2026, 10, 10, 0, 0, 0).getTime();
    expect(nextLocalMidnight(NOON)).toBe(midnight);
    expect(nextLocalMidnight(midnight - 1)).toBe(midnight);
    expect(nextLocalMidnight(midnight)).toBe(
      new Date(2026, 10, 11, 0, 0, 0).getTime(),
    );
    expect(localDay(midnight - 1)).not.toBe(localDay(midnight));
  });
});

describe("inviteDue gates", () => {
  const dayDue = withInvite({ lastDay: "2026-11-08" });

  it("is due on a new day when every gate is open", () => {
    expect(inviteDue(dayDue, "day")).toBe(true);
  });

  it.each([
    ["askToStart is off", { askToStart: false }],
    ["hidden everywhere", { hideEverywhere: true }],
    ["signed out", { signedIn: false }],
    ["the timer is running", { timerIdle: false }],
    ["an invite is already pending", { inviteSince: NOON - 1 }],
  ])("is not due when %s", (_n, patch) => {
    expect(inviteDue({ ...dayDue, ...patch }, "day")).toBe(false);
  });

  it("is not due while declined, and due again exactly at declinedUntil", () => {
    const declined = { ...dayDue.invite, declinedUntil: NOON + 1 };
    expect(inviteDue({ ...dayDue, invite: declined }, "day")).toBe(false);
    expect(
      inviteDue(
        { ...dayDue, invite: { ...declined, declinedUntil: NOON } },
        "day",
      ),
    ).toBe(true);
  });
});

describe("day trigger", () => {
  it("fires only once per local day", () => {
    expect(inviteDue(withInvite({ lastDay: "2026-11-08" }), "day")).toBe(true);
    expect(inviteDue(withInvite({ lastDay: "" }), "day")).toBe(true);
    expect(inviteDue(withInvite({ lastDay: "2026-11-09" }), "day")).toBe(false);
  });

  it("fires just after local midnight", () => {
    const midnight = new Date(2026, 10, 10, 0, 0, 0).getTime();
    const input = withInvite({ lastDay: "2026-11-09" });
    expect(inviteDue({ ...input, now: midnight - 1 }, "day")).toBe(false);
    expect(inviteDue({ ...input, now: midnight }, "day")).toBe(true);
  });
});

describe("afterStop trigger", () => {
  const stoppedAt = NOON - AFTER_STOP_MS;
  it("needs a recorded Stop", () => {
    expect(inviteDue(withInvite({ stoppedAt: 0 }), "afterStop")).toBe(false);
  });
  it("is not due one ms before 10 minutes and due at 10 minutes", () => {
    expect(
      inviteDue({ ...withInvite({ stoppedAt }), now: NOON - 1 }, "afterStop"),
    ).toBe(false);
    expect(inviteDue(withInvite({ stoppedAt }), "afterStop")).toBe(true);
  });
});

describe("idle trigger", () => {
  it("is not due one ms before 45 minutes idle and due at 45", () => {
    expect(
      inviteDue({ ...base, lastActivityAt: NOON - IDLE_MS + 1 }, "idle"),
    ).toBe(false);
    expect(inviteDue({ ...base, lastActivityAt: NOON - IDLE_MS }, "idle")).toBe(
      true,
    );
  });
  it("also needs 45 minutes since the last invite", () => {
    const idle = { ...base, lastActivityAt: 0 };
    expect(
      inviteDue(
        { ...idle, invite: { ...base.invite, lastAt: NOON - IDLE_MS + 1 } },
        "idle",
      ),
    ).toBe(false);
    expect(
      inviteDue(
        { ...idle, invite: { ...base.invite, lastAt: NOON - IDLE_MS } },
        "idle",
      ),
    ).toBe(true);
  });
});

describe("inviteExpired", () => {
  it("is false when none pending", () => {
    expect(inviteExpired(0, NOON)).toBe(false);
  });
  it("expires at 30 minutes", () => {
    expect(inviteExpired(NOON - INVITE_TTL_MS + 1, NOON)).toBe(false);
    expect(inviteExpired(NOON - INVITE_TTL_MS, NOON)).toBe(true);
  });
});

describe("answerInvite", () => {
  it("later waits 30 minutes", () => {
    expect(answerInvite("later", NOON, 5)).toBe(NOON + LATER_MS);
  });
  it("notToday waits until local midnight", () => {
    expect(answerInvite("notToday", NOON, 5)).toBe(nextLocalMidnight(NOON));
  });
  it("start leaves declinedUntil unchanged", () => {
    expect(answerInvite("start", NOON, 5)).toBe(5);
  });
});

describe("lastActivityAt", () => {
  const session = (endedAt: number) => ({
    id: "s",
    taskId: null,
    phase: "work" as const,
    startedAt: 0,
    endedAt,
    completed: true,
  });
  it("is 0 with no activity", () => {
    expect(lastActivityAt([], null)).toBe(0);
  });
  it("uses the latest session end", () => {
    expect(lastActivityAt([session(5), session(9), session(7)], null)).toBe(9);
  });
  it("uses the phase start when it is later", () => {
    expect(lastActivityAt([session(5)], 20)).toBe(20);
  });
});

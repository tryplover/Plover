import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/features/auth/session")>()),
  isSignedIn: async () => true,
}));
import {
  registerBuddyHandlers,
  reconcileInvite,
} from "@/features/buddy/worker";
import { registerTimerHandlers } from "@/features/timer/worker";
import { checkInvite } from "@/features/buddy/worker";
import { localDay, nextLocalMidnight } from "@/features/buddy/invite";
import { dispatch } from "@/worker/controller";
import { getLocal, setLocal } from "@/shared/storage";

const MIN = 60_000;
const T0 = new Date(2026, 10, 9, 12, 0, 0).getTime();

async function fireAlarm(name: string) {
  await fakeBrowser.alarms.onAlarm.trigger({
    name,
    scheduledTime: Date.now(),
    persistAcrossSessions: false,
  });
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  registerTimerHandlers();
  registerBuddyHandlers();
  await setLocal({ needsSignIn: false });
});

afterEach(() => vi.useRealTimers());

describe("checkInvite", () => {
  it("raises the day invite once and records it", async () => {
    await checkInvite("day");
    expect((await getLocal("transient")).inviteSince).toBe(T0);
    expect(await getLocal("invite")).toMatchObject({
      lastDay: localDay(T0),
      lastAt: T0,
    });
  });

  it("does nothing when signed out", async () => {
    await setLocal({ needsSignIn: true });
    await checkInvite("day");
    expect((await getLocal("transient")).inviteSince).toBe(0);
  });

  it("does nothing when askToStart is off", async () => {
    await fakeBrowser.storage.sync.set({ settings: { askToStart: false } });
    await checkInvite("day");
    expect((await getLocal("transient")).inviteSince).toBe(0);
  });
});

describe("invite/answer", () => {
  beforeEach(async () => {
    await checkInvite("day");
  });

  it("later clears the invite and declines for 30 minutes", async () => {
    await dispatch({ type: "invite/answer", choice: "later" });
    expect((await getLocal("transient")).inviteSince).toBe(0);
    expect((await getLocal("invite")).declinedUntil).toBe(T0 + 30 * MIN);
  });

  it("notToday declines until local midnight", async () => {
    await dispatch({ type: "invite/answer", choice: "notToday" });
    expect((await getLocal("invite")).declinedUntil).toBe(
      nextLocalMidnight(T0),
    );
  });

  it("start clears the invite without declining", async () => {
    await dispatch({ type: "invite/answer", choice: "start" });
    expect((await getLocal("transient")).inviteSince).toBe(0);
    expect((await getLocal("invite")).declinedUntil).toBe(0);
  });
});

describe("timer events", () => {
  it("stop records stoppedAt; the invite-check alarm raises it 10 minutes later", async () => {
    await setLocal({
      invite: {
        declinedUntil: 0,
        lastDay: localDay(T0),
        lastAt: T0,
        stoppedAt: 0,
      },
    });
    await dispatch({ type: "timer/start" });
    await dispatch({ type: "timer/stop" });
    expect((await getLocal("invite")).stoppedAt).toBe(T0);

    vi.setSystemTime(T0 + 10 * MIN - 1);
    await fireAlarm("invite-check");
    expect((await getLocal("transient")).inviteSince).toBe(0);

    vi.setSystemTime(T0 + 10 * MIN);
    await fireAlarm("invite-check");
    expect((await getLocal("transient")).inviteSince).toBe(T0 + 10 * MIN);
  });

  it("a started phase clears stoppedAt and a pending invite", async () => {
    await checkInvite("day");
    await setLocal({
      invite: { ...(await getLocal("invite")), stoppedAt: T0 - MIN },
    });
    await dispatch({ type: "timer/start" });
    expect((await getLocal("transient")).inviteSince).toBe(0);
    expect((await getLocal("invite")).stoppedAt).toBe(0);
  });
});

describe("invite-check alarm", () => {
  it("expires a stale invite like Later", async () => {
    await checkInvite("day");
    vi.setSystemTime(T0 + 30 * MIN);
    await fireAlarm("invite-check");
    expect((await getLocal("transient")).inviteSince).toBe(0);
    expect((await getLocal("invite")).declinedUntil).toBe(T0 + 60 * MIN);
  });

  it("raises the long-idle invite", async () => {
    await setLocal({
      invite: {
        declinedUntil: 0,
        lastDay: localDay(T0),
        lastAt: 0,
        stoppedAt: 0,
      },
    });
    await fireAlarm("invite-check");
    expect((await getLocal("transient")).inviteSince).toBe(T0);
  });
});

describe("reconcileInvite", () => {
  it("registers the 5-minute alarm once", async () => {
    await reconcileInvite();
    expect(
      (await fakeBrowser.alarms.get("invite-check"))?.periodInMinutes,
    ).toBe(5);
    await reconcileInvite();
    expect(await fakeBrowser.alarms.getAll()).toHaveLength(1);
  });
});

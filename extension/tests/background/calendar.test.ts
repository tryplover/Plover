import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  isSignedIn: async () => true,
}));
import { dispatch } from "@/background/controller";
import { registerCalendarHandlers } from "@/background/calendar";
import { getLocal, setLocal } from "@/lib/storage";

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const REDIRECT = "https://abc.chromiumapp.org/";
const launchWebAuthFlow = vi.fn();
const fetchMock = vi.fn();
const sessionToken = async () =>
  (await fakeBrowser.storage.session.get("googleToken"))["googleToken"] ?? null;

const redirectWith = (token: string, expiresIn = 3599) =>
  `${REDIRECT}#access_token=${token}&token_type=Bearer&expires_in=${expiresIn}`;

const apiEvent = (id: string, title: string, start: number, mins = 30) => ({
  id,
  summary: title,
  start: { dateTime: new Date(start).toISOString() },
  end: { dateTime: new Date(start + mins * MIN).toISOString() },
});

function respondWith(items: unknown[]) {
  fetchMock.mockResolvedValue(Response.json({ items }));
}

async function fireAlarm(name: string) {
  const alarm = await fakeBrowser.alarms.get(name);
  await fakeBrowser.alarms.onAlarm.trigger(
    alarm ?? { name, scheduledTime: Date.now(), persistAcrossSessions: false },
  );
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  launchWebAuthFlow.mockReset();
  fetchMock.mockReset();
  respondWith([]);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WXT_GOOGLE_CLIENT_ID", "cid");
  Object.assign(fakeBrowser.identity, {
    launchWebAuthFlow,
    getRedirectURL: () => REDIRECT,
  });
  registerCalendarHandlers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("calendar/connect", () => {
  it("runs the implicit flow, stores the token, connects and schedules refresh", async () => {
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok"));
    respondWith([apiEvent("a", "Stand-up", T0 + 40 * MIN)]);

    expect(await dispatch({ type: "calendar/connect" })).toEqual({ ok: true });

    const call = launchWebAuthFlow.mock.calls[0]?.[0] as {
      url: string;
      interactive: boolean;
    };
    expect(call.interactive).toBe(true);
    const u = new URL(call.url);
    expect(u.origin + u.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "cid",
      response_type: "token",
      redirect_uri: REDIRECT,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    });
    expect(await sessionToken()).toEqual({
      accessToken: "tok",
      expiresAt: T0 + 3599_000,
    });
    expect(
      (await fakeBrowser.storage.local.get("googleToken"))["googleToken"],
    ).toBeUndefined();
    expect(await getLocal("calendarConnected")).toBe(true);
    expect((await getLocal("calendar")).events).toHaveLength(1);
    expect(
      (await fakeBrowser.alarms.get("calendar-refresh"))?.periodInMinutes,
    ).toBe(15);
  });

  it("leaves state unchanged when the window is closed or has no token", async () => {
    launchWebAuthFlow.mockResolvedValue(undefined);
    expect((await dispatch({ type: "calendar/connect" })).ok).toBe(false);
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT}#error=access_denied`);
    expect((await dispatch({ type: "calendar/connect" })).ok).toBe(false);
    launchWebAuthFlow.mockRejectedValue(new Error("closed"));
    expect((await dispatch({ type: "calendar/connect" })).ok).toBe(false);
    expect(await getLocal("calendarConnected")).toBe(false);
    expect(await sessionToken()).toBeNull();
  });

  it("does not hold the queue while the interactive flow is open", async () => {
    let finish: (v: string) => void = () => undefined;
    launchWebAuthFlow.mockReturnValue(
      new Promise<string>((r) => {
        finish = r;
      }),
    );
    const connecting = dispatch({ type: "calendar/connect" });
    const other = await dispatch({ type: "calendar/disconnect" });
    expect(other.ok).toBe(true);
    finish(redirectWith("tok"));
    await connecting;
  });
});

describe("calendar-refresh", () => {
  async function connected(expiresIn = 3599) {
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok", expiresIn));
    await dispatch({ type: "calendar/connect" });
    launchWebAuthFlow.mockReset();
    fetchMock.mockClear();
  }

  it("uses the cached token while valid", async () => {
    await connected();
    respondWith([apiEvent("a", "A", T0 + 20 * MIN)]);
    await fireAlarm("calendar-refresh");
    expect(launchWebAuthFlow).not.toHaveBeenCalled();
    expect((await getLocal("calendar")).events[0]?.id).toBe("a");
  });

  it("refreshes an expired token non-interactively", async () => {
    await connected(60);
    vi.setSystemTime(T0 + 10 * MIN);
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok2"));
    await fireAlarm("calendar-refresh");
    expect(launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers["Authorization"]).toBe("Bearer tok2");
  });

  it("disconnects quietly when silent re-auth fails", async () => {
    await connected(60);
    vi.setSystemTime(T0 + 10 * MIN);
    launchWebAuthFlow.mockRejectedValue(new Error("interaction required"));
    await fireAlarm("calendar-refresh");
    expect(await getLocal("calendarConnected")).toBe(false);
    expect(await sessionToken()).toBeNull();
    expect((await getLocal("calendar")).events).toEqual([]);
  });

  it("on 401 retries once silently, then disconnects if that fails", async () => {
    await connected();
    fetchMock.mockResolvedValue(new Response("no", { status: 401 }));
    launchWebAuthFlow.mockRejectedValue(new Error("interaction required"));
    await fireAlarm("calendar-refresh");
    expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect(await getLocal("calendarConnected")).toBe(false);
    expect(await sessionToken()).toBeNull();
  });

  it("on 401 recovers with a silently obtained token", async () => {
    await connected();
    fetchMock
      .mockResolvedValueOnce(new Response("no", { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({ items: [apiEvent("b", "B", T0 + 20 * MIN)] }),
      );
    launchWebAuthFlow.mockResolvedValue(redirectWith("fresh"));
    await fireAlarm("calendar-refresh");
    expect(await getLocal("calendarConnected")).toBe(true);
    expect((await getLocal("calendar")).events[0]?.id).toBe("b");
  });

  it("keeps connected and the cache on a transient network error", async () => {
    await connected();
    respondWith([apiEvent("a", "A", T0 + 20 * MIN)]);
    await fireAlarm("calendar-refresh");
    fetchMock.mockRejectedValue(new Error("offline"));
    await fireAlarm("calendar-refresh");
    expect(await getLocal("calendarConnected")).toBe(true);
    expect((await getLocal("calendar")).events).toHaveLength(1);
  });
});

describe("calendar/disconnect", () => {
  it("clears token, cache, alarms and connected flag", async () => {
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok"));
    respondWith([apiEvent("a", "A", T0 + 20 * MIN)]);
    await dispatch({ type: "calendar/connect" });
    await dispatch({ type: "calendar/disconnect" });
    expect(await sessionToken()).toBeNull();
    expect(await getLocal("calendarConnected")).toBe(false);
    expect((await getLocal("calendar")).events).toEqual([]);
    expect(await fakeBrowser.alarms.get("calendar-refresh")).toBeUndefined();
    expect(await fakeBrowser.alarms.get("calendar-headsup")).toBeUndefined();
  });
});

describe("heads-up", () => {
  async function connectWithEvent(startOffset: number, allDay = false) {
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok"));
    respondWith([
      allDay
        ? {
            id: "d",
            summary: "Holiday",
            start: { date: "2026-10-27" },
            end: { date: "2026-10-28" },
          }
        : apiEvent("a", "Stand-up", T0 + startOffset),
    ]);
    await dispatch({ type: "calendar/connect" });
  }

  it("during focus, schedules the alarm 5 min before and nudges", async () => {
    await setLocal({ focus: { on: true, startedAt: T0 } });
    await connectWithEvent(20 * MIN);
    const alarm = await fakeBrowser.alarms.get("calendar-headsup");
    expect(alarm?.scheduledTime).toBe(T0 + 15 * MIN);

    vi.setSystemTime(T0 + 15 * MIN);
    await fireAlarm("calendar-headsup");
    const t = await getLocal("transient");
    expect(t.nudgeText).toBe("Stand-up starts in 5 min");
    expect(t.nudgeUntil).toBe(T0 + 16 * MIN);
  });

  it("targets the next upcoming event, not one already in progress", async () => {
    await setLocal({ focus: { on: true, startedAt: T0 } });
    launchWebAuthFlow.mockResolvedValue(redirectWith("tok"));
    respondWith([
      apiEvent("run", "Running", T0 - 10 * MIN, 60),
      apiEvent("later", "Later", T0 + 30 * MIN),
    ]);
    await dispatch({ type: "calendar/connect" });
    const alarm = await fakeBrowser.alarms.get("calendar-headsup");
    expect(alarm?.scheduledTime).toBe(T0 + 25 * MIN);
    vi.setSystemTime(T0 + 25 * MIN);
    await fireAlarm("calendar-headsup");
    expect((await getLocal("transient")).nudgeText).toBe(
      "Later starts in 5 min",
    );
  });

  it("does nothing if focus ended before the alarm fired", async () => {
    await setLocal({ focus: { on: true, startedAt: T0 } });
    await connectWithEvent(20 * MIN);
    await setLocal({ focus: { on: false, startedAt: null } });
    await fireAlarm("calendar-headsup");
    expect((await getLocal("transient")).nudgeText).toBeNull();
  });

  it("is not scheduled outside focus, for past alarm times, or all-day events", async () => {
    await connectWithEvent(20 * MIN);
    expect(await fakeBrowser.alarms.get("calendar-headsup")).toBeUndefined();
    await setLocal({ focus: { on: true, startedAt: T0 } });
    await connectWithEvent(3 * MIN);
    expect(await fakeBrowser.alarms.get("calendar-headsup")).toBeUndefined();
    await connectWithEvent(0, true);
    expect(await fakeBrowser.alarms.get("calendar-headsup")).toBeUndefined();
  });
});

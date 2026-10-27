import { describe, expect, it, vi } from "vitest";
import { CalendarAuthError, fetchUpcoming } from "@/features/calendar/client";

const T0 = Date.parse("2026-10-26T15:00:00Z");

describe("fetchUpcoming", () => {
  it("requests the next 24h of the primary calendar with a bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        items: [
          {
            id: "a",
            summary: "Stand-up",
            start: { dateTime: "2026-10-26T16:00:00Z" },
            end: { dateTime: "2026-10-26T16:30:00Z" },
          },
        ],
      }),
    );
    const events = await fetchUpcoming(
      "tok",
      T0,
      fetchImpl as unknown as typeof fetch,
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    expect(Object.fromEntries(u.searchParams)).toEqual({
      timeMin: "2026-10-26T15:00:00.000Z",
      timeMax: "2026-10-27T15:00:00.000Z",
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok",
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(events).toHaveLength(1);
  });

  it("throws CalendarAuthError on 401 and Error on other failures", async () => {
    const f401 = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(
      fetchUpcoming("t", T0, f401 as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(CalendarAuthError);
    const f500 = vi.fn(async () => new Response("no", { status: 500 }));
    await expect(
      fetchUpcoming("t", T0, f500 as unknown as typeof fetch),
    ).rejects.toThrow(/500/);
  });
});

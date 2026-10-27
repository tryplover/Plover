import { browser } from "wxt/browser";
import {
  CalendarAuthError,
  fetchUpcoming,
  clearToken,
  getCalendarToken,
  requestToken,
  storeToken,
} from "@/lib/calendar/client";
import { nextUpcoming } from "@/lib/calendar/events";
import type { CalendarEvent } from "@/lib/types";
import { DEFAULT_LOCAL, getLocal, setLocal } from "@/lib/storage";
import { onAlarm } from "./alarms";
import { registerHandler } from "./controller";
import { enqueue } from "./queue";

export const CALENDAR_HEADSUP_ALARM = "calendar-headsup";
const REFRESH_ALARM = "calendar-refresh";
const REFRESH_MINUTES = 15;
const HEADSUP_LEAD_MS = 5 * 60_000;
const NUDGE_VISIBLE_MS = 60_000;

async function clearConnection(): Promise<void> {
  await browser.alarms.clear(REFRESH_ALARM);
  await browser.alarms.clear(CALENDAR_HEADSUP_ALARM);
  await clearToken();
  await setLocal({
    calendar: DEFAULT_LOCAL.calendar,
    calendarConnected: false,
  });
}

export async function scheduleHeadsUp(): Promise<void> {
  await browser.alarms.clear(CALENDAR_HEADSUP_ALARM);
  const [focus, connected, calendar] = await Promise.all([
    getLocal("focus"),
    getLocal("calendarConnected"),
    getLocal("calendar"),
  ]);
  if (!focus.on || !connected) return;
  const now = Date.now();
  const next = nextUpcoming(calendar.events, now);
  if (!next) return;
  const when = next.start - HEADSUP_LEAD_MS;
  if (when <= now) return;
  await browser.alarms.create(CALENDAR_HEADSUP_ALARM, { when });
}

type FetchOutcome = CalendarEvent[] | "disconnect" | "skip";

async function fetchEvents(): Promise<FetchOutcome> {
  let token = await getCalendarToken(false);
  if (!token) return "disconnect";
  try {
    try {
      return await fetchUpcoming(token, Date.now());
    } catch (e) {
      if (!(e instanceof CalendarAuthError)) throw e;
      await clearToken();
      token = await getCalendarToken(false);
      if (!token) return "disconnect";
      return await fetchUpcoming(token, Date.now());
    }
  } catch (e) {
    return e instanceof CalendarAuthError ? "disconnect" : "skip";
  }
}

async function refreshCalendar(): Promise<void> {
  if (!(await getLocal("calendarConnected"))) return;
  const outcome = await fetchEvents();
  await enqueue(async () => {
    if (!(await getLocal("calendarConnected"))) return clearToken();
    if (outcome === "disconnect") return clearConnection();
    if (outcome === "skip") return;
    await setLocal({ calendar: { events: outcome, fetchedAt: Date.now() } });
    await scheduleHeadsUp();
  });
}

export async function reconcileCalendar(): Promise<void> {
  if (!(await getLocal("calendarConnected"))) return;
  await browser.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_MINUTES,
  });
  await refreshCalendar();
}

export function registerCalendarHandlers(): void {
  registerHandler("calendar/connect", async () => {
    const token = await requestToken(true);
    if (!token) return { ok: false, error: "Calendar sign-in was cancelled" };
    await enqueue(async () => {
      await storeToken(token);
      await setLocal({ calendarConnected: true });
      await browser.alarms.create(REFRESH_ALARM, {
        periodInMinutes: REFRESH_MINUTES,
      });
    });
    await refreshCalendar();
    return { ok: true };
  });

  registerHandler("calendar/disconnect", async () => {
    await clearConnection();
    return { ok: true };
  });

  onAlarm(REFRESH_ALARM, refreshCalendar, { queued: false });

  onAlarm(CALENDAR_HEADSUP_ALARM, async () => {
    const [focus, calendar, transient] = await Promise.all([
      getLocal("focus"),
      getLocal("calendar"),
      getLocal("transient"),
    ]);
    if (!focus.on) return;
    const now = Date.now();
    const next = nextUpcoming(calendar.events, now);
    if (!next) return;
    await setLocal({
      transient: {
        ...transient,
        nudgeText: `${next.title} starts in 5 min`,
        nudgeUntil: now + NUDGE_VISIBLE_MS,
      },
    });
  });
}

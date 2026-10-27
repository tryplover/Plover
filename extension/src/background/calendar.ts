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
import { DEFAULT_LOCAL, getLocal, setLocal } from "@/lib/storage";
import { onAlarm } from "./alarms";
import { registerHandler } from "./controller";
import { enqueue } from "./queue";

export const CALENDAR_HEADSUP_ALARM = "calendar-headsup";
const REFRESH_ALARM = "calendar-refresh";
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

async function refreshCalendar(): Promise<void> {
  if (!(await getLocal("calendarConnected"))) return;
  let token = await getCalendarToken(false);
  if (!token) return clearConnection();
  let events;
  try {
    try {
      events = await fetchUpcoming(token, Date.now());
    } catch (e) {
      if (!(e instanceof CalendarAuthError)) throw e;
      await clearToken();
      token = await getCalendarToken(false);
      if (!token) return clearConnection();
      events = await fetchUpcoming(token, Date.now());
    }
  } catch (e) {
    if (e instanceof CalendarAuthError) return clearConnection();
    return;
  }
  await setLocal({ calendar: { events, fetchedAt: Date.now() } });
  await scheduleHeadsUp();
}

export function registerCalendarHandlers(): void {
  registerHandler("calendar/connect", async () => {
    const token = await requestToken(true);
    if (!token) return { ok: false, error: "Calendar sign-in was cancelled" };
    return enqueue(async () => {
      await storeToken(token);
      await setLocal({ calendarConnected: true });
      await browser.alarms.create(REFRESH_ALARM, { periodInMinutes: 15 });
      await refreshCalendar();
      return { ok: true };
    });
  });

  registerHandler("calendar/disconnect", async () => {
    await clearConnection();
    return { ok: true };
  });

  onAlarm(REFRESH_ALARM, refreshCalendar);

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

import { browser } from "wxt/browser";
import type { CalendarEvent } from "@/lib/types";
import { parseEvents } from "./events";

export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const FETCH_TIMEOUT_MS = 10_000;
const EXPIRY_SLACK_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

export class CalendarAuthError extends Error {}

export interface GoogleToken {
  accessToken: string;
  expiresAt: number;
}

export async function fetchUpcoming(
  token: string,
  nowMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(nowMs).toISOString(),
    timeMax: new Date(nowMs + DAY_MS).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${EVENTS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (res.status === 401)
      throw new CalendarAuthError("Calendar token rejected");
    if (!res.ok) throw new Error(`Calendar request failed: ${res.status}`);
    return parseEvents(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function requestToken(
  interactive: boolean,
): Promise<GoogleToken | null> {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", import.meta.env.WXT_GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("redirect_uri", browser.identity.getRedirectURL());
  url.searchParams.set("scope", CALENDAR_SCOPE);
  let returned: string | undefined;
  try {
    returned = await browser.identity.launchWebAuthFlow({
      url: url.toString(),
      interactive,
    });
  } catch {
    return null;
  }
  if (!returned) return null;
  const hash = returned.split("#")[1] ?? "";
  const fragment = new URLSearchParams(hash);
  const accessToken = fragment.get("access_token");
  const expiresIn = Number(fragment.get("expires_in"));
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0)
    return null;
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

const TOKEN_KEY = "googleToken";

async function readToken(): Promise<GoogleToken | null> {
  const stored = await browser.storage.session.get(TOKEN_KEY);
  return (stored[TOKEN_KEY] as GoogleToken | undefined) ?? null;
}

export async function storeToken(token: GoogleToken): Promise<void> {
  await browser.storage.session.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  await browser.storage.session.remove(TOKEN_KEY);
}

export async function getCalendarToken(
  interactive: boolean,
): Promise<string | null> {
  const cached = await readToken();
  if (cached && cached.expiresAt - EXPIRY_SLACK_MS > Date.now()) {
    return cached.accessToken;
  }
  const fresh = await requestToken(interactive);
  if (!fresh) return null;
  await storeToken(fresh);
  return fresh.accessToken;
}

import { browser } from "wxt/browser";
import { IDLE_TIMER } from "./timer/machine";
import type { TimerConfig } from "./timer/types";
import type { LocalState, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  blocksPerLongBreak: 4,
  focusNudgeMinutes: 15,
  blocklist: [],
  buddyCorner: "bottom-right",
  hiddenSites: [],
  hideEverywhere: false,
};

export const DEFAULT_LOCAL: LocalState = {
  tasks: [],
  activeTaskId: null,
  timer: IDLE_TIMER,
  phaseStartedAt: null,
  sessions: [],
  focus: { on: false, startedAt: null },
  blockingOn: false,
  transient: {
    checkInPending: false,
    nudgeText: null,
    nudgeUntil: 0,
    celebrateUntil: 0,
  },
  needsSignIn: false,
  calendar: { events: [], fetchedAt: 0 },
  calendarConnected: false,
};

const SETTINGS_KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] as Partial<Settings> | undefined),
  };
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getLocal<K extends keyof LocalState>(
  key: K,
): Promise<LocalState[K]> {
  const stored = await browser.storage.local.get(key);
  return (stored[key] as LocalState[K] | undefined) ?? DEFAULT_LOCAL[key];
}

export async function setLocal(patch: Partial<LocalState>): Promise<void> {
  await browser.storage.local.set(patch);
}

export function timerConfig(s: Settings): TimerConfig {
  return {
    workMinutes: s.workMinutes,
    shortBreakMinutes: s.shortBreakMinutes,
    longBreakMinutes: s.longBreakMinutes,
    blocksPerLongBreak: s.blocksPerLongBreak,
  };
}

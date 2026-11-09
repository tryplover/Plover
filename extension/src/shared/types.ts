import type { RunningPhase, TimerState } from "@/features/timer/types";

export type BuddyCorner =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type Theme = "system" | "light" | "dark";

export interface Settings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksPerLongBreak: number;
  focusNudgeMinutes: number;
  blocklist: string[];
  buddyCorner: BuddyCorner;
  hiddenSites: string[];
  hideEverywhere: boolean;
  theme: Theme;
  askToStart: boolean;
}

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export interface ParkedTimer {
  remainingMs: number;
  blocksCompleted: number;
  parkedAt: number;
}

export interface Task {
  id: string;
  title: string;
  steps: Step[];
  createdAt: number;
  doneAt: number | null;
  parked?: ParkedTimer | null;
  lastActiveAt?: number;
}

export interface Session {
  id: string;
  taskId: string | null;
  phase: RunningPhase;
  startedAt: number;
  endedAt: number;
  completed: boolean;
}

export interface FocusState {
  on: boolean;
  startedAt: number | null;
}

export interface Transient {
  checkInPending: boolean;
  checkInTaskId: string | null;
  nudgeText: string | null;
  nudgeUntil: number;
  celebrateUntil: number;
  inviteSince: number;
}

export interface InviteState {
  declinedUntil: number;
  lastDay: string;
  lastAt: number;
  stoppedAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
}

export interface LocalState {
  tasks: Task[];
  activeTaskId: string | null;
  timer: TimerState;
  phaseStartedAt: number | null;
  sessions: Session[];
  focus: FocusState;
  blockingOn: boolean;
  transient: Transient;
  invite: InviteState;
  needsSignIn: boolean;
  calendar: { events: CalendarEvent[]; fetchedAt: number };
  calendarConnected: boolean;
}

export type BuddyAnimationState =
  | "idle"
  | "working"
  | "break"
  | "focus"
  | "nudging"
  | "celebrating"
  | "inviting";

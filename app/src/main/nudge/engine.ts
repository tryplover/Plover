import { findStalledGoalIds, type StallTaskInput } from './stall.js';
import {
  STALL_NUDGE_LAST_AT_KEY,
  STALL_NUDGE_LAST_BY_GOAL_KEY,
} from '../store/repos/settings.js';

const STALL_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export interface StallNudgeDeps {
  tasks: { listStallInputs(): StallTaskInput[] };
  goals: { get(id: string): { title: string } | null };
  settings: {
    getAll(): { stallNudgeEnabled: boolean; workingHours: { start: string; end: string } };
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
  notify: (title: string, body: string) => void;
  now: () => Date;
}

function minutesOfDay(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export class StallNudgeEngine {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: StallNudgeDeps) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.check(this.deps.now()), CHECK_INTERVAL_MS);
    this.check(this.deps.now());
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  check(now: Date): void {
    const { settings, tasks, goals } = this.deps;
    const { stallNudgeEnabled, workingHours } = settings.getAll();
    if (!stallNudgeEnabled) return;

    const day = now.getDay();
    if (day === 0 || day === 6) return;

    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < minutesOfDay(workingHours.start) || minutes >= minutesOfDay(workingHours.end)) {
      return;
    }

    const lastAtRaw = settings.get(STALL_NUDGE_LAST_AT_KEY);
    if (lastAtRaw && sameLocalDay(new Date(lastAtRaw), now)) return;

    const inputs = tasks.listStallInputs();
    const stalled = findStalledGoalIds({ now, stallMs: STALL_MS, tasks: inputs });
    if (stalled.length === 0) return;

    const lastChangeByGoal = new Map<string, number>();
    for (const t of inputs) {
      const ms = Date.parse(t.status_changed_at);
      lastChangeByGoal.set(t.goal_id, Math.max(lastChangeByGoal.get(t.goal_id) ?? 0, ms));
    }

    const rawMap = settings.get(STALL_NUDGE_LAST_BY_GOAL_KEY);
    const nudged: Record<string, string> = rawMap ? JSON.parse(rawMap) : {};

    for (const goalId of stalled) {
      const nudgedAt = nudged[goalId];
      if (nudgedAt && Date.parse(nudgedAt) >= (lastChangeByGoal.get(goalId) ?? 0)) continue;

      const goal = goals.get(goalId);
      if (!goal) continue;

      this.deps.notify('Plover', `Still on "${goal.title}"? Pick the next step, or split it.`);
      nudged[goalId] = now.toISOString();
      settings.set(STALL_NUDGE_LAST_BY_GOAL_KEY, JSON.stringify(nudged));
      settings.set(STALL_NUDGE_LAST_AT_KEY, now.toISOString());
      return;
    }
  }
}

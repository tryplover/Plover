import { ActivityRepo } from '@main/store/repos/activity.js';
import { SettingsRepo, SettingsData } from '@main/store/repos/settings.js';
import { TypedEventBus } from '@main/events/bus.js';
import { EventPayloads } from '@shared/events.js';
import { gate } from '@main/activity/shared/gate.js';

type BoolKeyOf<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];

export interface SubscriberSpec {
  event: keyof EventPayloads;
  gate: BoolKeyOf<SettingsData>;
  kind: string;
}

export interface ActivitySubscriberDeps {
  activityRepo: ActivityRepo;
  settingsRepo: SettingsRepo;
  eventBus: TypedEventBus;
}

export interface ActivitySubscriberGroup {
  start(): void;
  stop(): void;
}

export function createActivitySubscribers(
  specs: readonly SubscriberSpec[],
  deps: ActivitySubscriberDeps,
): ActivitySubscriberGroup {
  const bound = specs.map((spec) => {
    const handler = (payload: EventPayloads[keyof EventPayloads]): void => {
      if (!gate(deps.settingsRepo, spec.gate)) return;
      deps.activityRepo.log(spec.kind, { ...(payload as Record<string, unknown>) });
    };
    return { spec, handler };
  });

  return {
    start(): void {
      for (const { spec, handler } of bound) deps.eventBus.on(spec.event, handler);
    },
    stop(): void {
      for (const { spec, handler } of bound) deps.eventBus.off(spec.event, handler);
    },
  };
}

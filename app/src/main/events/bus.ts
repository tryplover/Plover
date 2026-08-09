import { EventEmitter } from 'node:events';
import { EventPayloads } from '@shared/events.js';

export class TypedEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof EventPayloads>(
    event: K,
    ...args: EventPayloads[K] extends undefined ? [] : [payload: EventPayloads[K]]
  ): boolean {
    return this.emitter.emit(event, ...args);
  }

  on<K extends keyof EventPayloads>(
    event: K,
    listener: EventPayloads[K] extends undefined ? () => void : (payload: EventPayloads[K]) => void,
  ): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  once<K extends keyof EventPayloads>(
    event: K,
    listener: EventPayloads[K] extends undefined ? () => void : (payload: EventPayloads[K]) => void,
  ): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof EventPayloads>(
    event: K,
    listener: EventPayloads[K] extends undefined ? () => void : (payload: EventPayloads[K]) => void,
  ): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  removeAllListeners(event?: keyof EventPayloads): this {
    if (event !== undefined) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }
}

export const eventBus = new TypedEventBus();

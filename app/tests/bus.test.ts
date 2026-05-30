import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus, eventBus } from '../src/main/bus.js';
import { Goal } from '../src/shared/types.js';

describe('TypedEventBus', () => {
  it('should emit and receive events with payloads', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();

    const mockGoal: Goal = {
      id: 'g-1',
      title: 'Test Goal',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bus.on('goal.created', handler);
    bus.emit('goal.created', mockGoal);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(mockGoal);
  });

  it('should support once listeners', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();

    const mockGoal: Goal = {
      id: 'g-1',
      title: 'Test Goal',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bus.once('goal.created', handler);
    bus.emit('goal.created', mockGoal);
    bus.emit('goal.created', mockGoal);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe using off', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();

    const mockGoal: Goal = {
      id: 'g-1',
      title: 'Test Goal',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bus.on('goal.created', handler);
    bus.emit('goal.created', mockGoal);
    bus.off('goal.created', handler);
    bus.emit('goal.created', mockGoal);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle events without payload (void)', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();

    bus.on('calendar.synced', handler);
    bus.emit('calendar.synced');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith();
  });

  it('should support removeAllListeners', () => {
    const bus = new TypedEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('calendar.synced', handler1);
    bus.on('calendar.synced', handler2);

    bus.removeAllListeners('calendar.synced');
    bus.emit('calendar.synced');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should use the shared global eventBus instance', () => {
    const handler = vi.fn();
    eventBus.on('calendar.synced', handler);
    eventBus.emit('calendar.synced');
    eventBus.off('calendar.synced', handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

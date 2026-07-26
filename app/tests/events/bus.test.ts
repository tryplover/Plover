import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus } from '../../src/main/events/bus.js';
import { Goal } from '../../src/shared/types.js';

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
});

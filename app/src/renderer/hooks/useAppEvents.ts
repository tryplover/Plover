import { useEffect, useRef } from 'react';

const DEFAULT_EVENTS = [
  'goal.created',
  'goal.updated',
  'goal.deleted',
  'task.created',
  'task.updated',
  'task.scheduled',
  'task.completed',
  'task.deleted',
  'tasks.reordered',
];

/**
 * Hook to subscribe to common app events that should trigger a data refresh.
 * @param callback Function to call when a relevant event occurs.
 */
export function useAppEvents(callback: () => void) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as { type: string };
      if (DEFAULT_EVENTS.includes(appEvent.type)) {
        savedCallback.current();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}

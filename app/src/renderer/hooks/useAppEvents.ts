import { useEffect } from 'react';
import { AppEvent } from '../../shared/events';

/**
 * useAppEvents is a refresh hook that triggers a callback whenever any of the
 * specified event types occur. It follows main process diverged pattern
 * where useAppEvents returns a self-contained refresh logic.
 */
export function useAppEvents(eventTypes: AppEvent['type'][], onRefresh: () => void) {
  useEffect(() => {
    const unsubscribe = window.api.on('app-event', (event: AppEvent) => {
      if (eventTypes.includes(event.type)) {
        onRefresh();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [eventTypes, onRefresh]);
}

import { useEffect } from 'react';
import { AppEvent } from '../../shared/events';

export function useAppEvents(callback: (event: AppEvent) => void) {
  useEffect(() => {
    const unsubscribe = window.api.on('app-event', callback);
    return () => {
      unsubscribe();
    };
  }, [callback]);
}

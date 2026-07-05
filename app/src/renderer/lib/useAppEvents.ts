import { useEffect, useMemo, useRef } from 'react';
import { isAppEvent, type AppEventType } from '../../shared/events';

export function useAppEvents(
  types: readonly AppEventType[],
  handler: () => void | Promise<void>,
) {
  // Memoize typeSet based on the contents of the types array. This prevents
  // re-subscriptions if the parent component passes a new array literal on every render.
  const typeKey = types.join(',');
  const typeSet = useMemo(() => new Set(typeKey.split(',') as AppEventType[]), [typeKey]);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    return window.api.on('app-event', (event: unknown) => {
      if (isAppEvent(event) && typeSet.has(event.type)) {
        void handlerRef.current();
      }
    });
  }, [typeSet]);
}

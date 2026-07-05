import { useEffect, useMemo, useRef } from 'react';
import { isAppEvent, type AppEventType } from '../../shared/events';

export function useAppEvents(
  types: readonly AppEventType[],
  handler: () => void | Promise<void>,
) {
  const typeSet = useMemo(() => new Set(types), [types]);
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

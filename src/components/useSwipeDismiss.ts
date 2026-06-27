import { useCallback, useEffect, useRef, type RefObject, type TouchEvent } from 'react';

const DISMISS_THRESHOLD_PX = 96;

export interface UseSwipeDismissOptions {
  onDismiss: () => void;
  enabled?: boolean;
}

export interface UseSwipeDismiss {
  bind: {
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  panelRef: RefObject<HTMLDivElement | null>;
}

export function useSwipeDismiss({
  onDismiss,
  enabled = true,
}: UseSwipeDismissOptions): UseSwipeDismiss {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const setDragOffset = useCallback((offset: number) => {
    dragOffsetRef.current = offset;
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
  }, []);

  const resetDrag = useCallback(() => {
    draggingRef.current = false;
    setDragOffset(0);
  }, [setDragOffset]);

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      draggingRef.current = true;
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled || !draggingRef.current) return;
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, currentY - startYRef.current);
      setDragOffset(delta);
    },
    [enabled, setDragOffset],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || !draggingRef.current) return;
    const offset = dragOffsetRef.current;
    resetDrag();
    if (offset >= DISMISS_THRESHOLD_PX) {
      onDismissRef.current();
    }
  }, [enabled, resetDrag]);

  return {
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    panelRef,
  };
}

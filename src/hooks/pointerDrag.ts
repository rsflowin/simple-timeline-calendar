export interface DragCallbacks {
  onMove(dx: number, dy: number, e: PointerEvent): void;
  /** moved=false means it was a click (pointer moved less than the threshold). */
  onEnd(dx: number, dy: number, e: PointerEvent, moved: boolean): void;
  onCancel(): void;
}

/** Tracks a drag from a pointerdown until pointerup, pointercancel or Esc. Main button only.
 * Returns a cleanup function that detaches listeners without triggering callbacks. */
export function startPointerDrag(
  e: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>,
  cb: DragCallbacks,
  threshold = 4,
): () => void {
  if (e.button !== 0) return () => {};
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < threshold) return;
    moved = true;
    cb.onMove(dx, dy, ev);
  };
  const up = (ev: PointerEvent) => {
    stop();
    cb.onEnd(ev.clientX - x0, ev.clientY - y0, ev, moved);
  };
  const cancel = () => {
    stop();
    cb.onCancel();
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.isComposing || ev.keyCode === 229) return;
    if (ev.key === 'Escape') cancel();
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
  return stop;
}

/** Tracks incremental pointer deltas to pan a scroll container without jumping if scroll bounds grow. */
export function createScrollPan(
  el: HTMLElement | null,
  e: Pick<PointerEvent, 'clientX' | 'clientY'>,
): (ev: Pick<PointerEvent, 'clientX' | 'clientY'>) => void {
  let lastX = e.clientX;
  let lastY = e.clientY;
  return (ev) => {
    if (!el) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    el.scrollLeft -= dx;
    el.scrollTop -= dy;
  };
}

export interface NonTaskDragOptions {
  scrollEl: HTMLElement | null;
  pan: boolean;
  onPanChange?(panning: boolean): void;
  onClick?(e: PointerEvent): void;
}

/** Handles click-only or drag-to-scroll pointer gestures when task-dragging is disabled. */
export function startNonTaskDrag(
  e: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>,
  { scrollEl, pan, onPanChange, onClick }: NonTaskDragOptions,
): () => void {
  const step = pan ? createScrollPan(scrollEl, e) : null;
  return startPointerDrag(e, {
    onMove: (_dx, _dy, ev) => {
      if (!step) return;
      onPanChange?.(true);
      step(ev);
    },
    onEnd: (_dx, _dy, ev, moved) => {
      if (step) onPanChange?.(false);
      if (!moved) onClick?.(ev);
    },
    onCancel: () => {
      if (step) onPanChange?.(false);
    },
  });
}

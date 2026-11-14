export interface DragCallbacks {
  onMove(dx: number, dy: number, e: PointerEvent): void;
  /** moved=false means it was a click (pointer moved less than the threshold). */
  onEnd(dx: number, dy: number, e: PointerEvent, moved: boolean): void;
  onCancel(): void;
}

/** Tracks a drag from a pointerdown until pointerup, pointercancel or Esc. Main button only. */
export function startPointerDrag(
  e: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>,
  cb: DragCallbacks,
  threshold = 4,
) {
  if (e.button !== 0) return;
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
}

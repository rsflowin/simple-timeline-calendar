import type { PointerEvent } from 'react';
import { useUi } from '../store/uiStore';

/** Select a task and preview it in the side peek: what a click on a bar does (CAL-6). */
export function openTask(id: string) {
  hideHover();
  useUi.getState().select(id);
  useUi.getState().peek(id);
}

/** Select a task and open its Task dialog: double-click, Enter, or Edit in the peek. */
export function editTask(id: string) {
  hideHover();
  useUi.getState().select(id);
  useUi.getState().openEdit(id);
}

const HOVER_DELAY = 400;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;

export function hideHover() {
  clearTimeout(hoverTimer);
  if (useUi.getState().hover) useUi.getState().setHover(null);
}

/** Pointer handlers that show the hover card for a task bar after a short rest. Mouse only. */
export function hoverProps(id: string) {
  return {
    onPointerEnter(e: PointerEvent<HTMLElement>) {
      if (e.pointerType !== 'mouse' || e.buttons) return; // touch, or mid-drag
      const el = e.currentTarget;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (el.isConnected) useUi.getState().setHover({ id, anchor: el.getBoundingClientRect() });
      }, HOVER_DELAY);
    },
    onPointerLeave: hideHover,
  };
}

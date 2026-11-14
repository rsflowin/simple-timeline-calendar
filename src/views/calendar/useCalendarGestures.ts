import { useEffect, useMemo, useState, type PointerEvent, type RefObject } from 'react';
import { fromDayIndex } from '../../domain/dates';
import { updateTask } from '../../domain/doc';
import { applyDrag, rangeBetween, type DayRange, type DragKind } from '../../domain/drag';
import type { TaskSpan } from '../../domain/spans';
import { startPointerDrag } from '../../hooks/pointerDrag';
import { useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { useUi } from '../../store/uiStore';
import { dayAtPoint } from './dayAtPoint';
import { withGesture, type CalSpan } from './layout';
import { openTask } from '../openTask';

export interface CalendarGestures {
  /** Spans to draw, including the drag preview and draft. */
  spans: readonly CalSpan[];
  draggingId: string | null;
  /** For the calendar body: presses on a day cell (not on a button) create tasks (CAL-5). */
  onEmptyPointerDown(e: PointerEvent<HTMLElement>): void;
  /** Move / resize / click a bar (CAL-6). */
  onBarPointerDown(e: PointerEvent<HTMLButtonElement>, s: TaskSpan): void;
}

/** Drag gestures shared by Month and Week view. `box` gets focus back when quick-create closes. */
export function useCalendarGestures(
  spans: readonly TaskSpan[],
  box: RefObject<HTMLElement | null>,
): CalendarGestures {
  /** Dashed range while drag-creating, kept until quick-create closes. */
  const [draft, setDraft] = useState<DayRange | null>(null);
  const [preview, setPreview] = useState<(DayRange & { id: string }) | null>(null);

  useEffect(
    () =>
      useUi.subscribe((s, prev) => {
        if (!prev.quickCreate || s.quickCreate) return;
        setDraft(null);
        box.current?.focus({ preventScroll: true });
      }),
    [box],
  );

  const shown = useMemo(() => withGesture(spans, preview, draft), [spans, preview, draft]);

  const onEmptyPointerDown = (e: PointerEvent<HTMLElement>) => {
    // Only presses on a day cell itself: bars, `+N more` and popovers (DOM descendants of the
    // calendar, over the cells) are not inside one. No stopPropagation: Popover listens on document.
    const cell = (e.target as Element).closest<HTMLElement>('[data-day]');
    if (e.button !== 0 || !cell) return;
    const d0 = Number(cell.dataset.day);
    e.preventDefault();
    let d1 = d0;
    const range = (ev: globalThis.PointerEvent): DayRange => {
      d1 = dayAtPoint(ev.clientX, ev.clientY) ?? d1;
      const [start, end] = rangeBetween(d0, d1);
      return { start, end };
    };
    startPointerDrag(e, {
      onMove: (_dx, _dy, ev) => setDraft(range(ev)),
      onEnd: (_dx, _dy, ev, moved) => {
        const r = moved ? range(ev) : { start: d0, end: d0 };
        setDraft(r);
        // Opened after pointerup: the popover closes on any pointerdown outside it.
        useUi.getState().openQuickCreate({
          start: fromDayIndex(r.start),
          end: fromDayIndex(r.end),
          anchor: new DOMRect(ev.clientX, ev.clientY, 0, 0),
        });
      },
      onCancel: () => setDraft(null),
    });
  };

  const onBarPointerDown = (e: PointerEvent<HTMLButtonElement>, s: TaskSpan) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = (e.target as HTMLElement).dataset.handle;
    const kind: DragKind =
      handle === 'start' ? 'resize-start' : handle === 'end' ? 'resize-end' : 'move';
    const bar = e.currentTarget;
    const d0 = dayAtPoint(e.clientX, e.clientY);
    let delta = 0;
    const dragged = (ev: globalThis.PointerEvent) => {
      const d = dayAtPoint(ev.clientX, ev.clientY);
      if (d !== null && d0 !== null) delta = d - d0; // off the grid: keep the last day
      return applyDrag(s, kind, delta);
    };
    startPointerDrag(e, {
      onMove: (_dx, _dy, ev) => setPreview({ id: s.id, ...dragged(ev) }),
      onEnd: (_dx, _dy, ev, moved) => {
        setPreview(null);
        if (!moved) {
          bar.focus(); // so the dialog hands focus back to the bar
          openTask(s.id);
          return;
        }
        const { start, end } = dragged(ev);
        try {
          // One commit per gesture = one undo step; a zero-day drag changes nothing.
          useRoadmap
            .getState()
            .commit((d) =>
              updateTask(d, s.id, { start: fromDayIndex(start), end: fromDayIndex(end) }),
            );
        } catch (err) {
          useStatus.getState().show((err as Error).message);
        }
      },
      onCancel: () => setPreview(null),
    });
  };

  return { spans: shown, draggingId: preview?.id ?? null, onEmptyPointerDown, onBarPointerDown };
}

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type Ref,
} from 'react';
import {
  formatRange,
  fromDayIndex,
  todayISO,
  toDayIndex,
  weekday,
  type DayIndex,
} from '../../domain/dates';
import { updateTask } from '../../domain/doc';
import { applyDrag, rangeBetween, type DragKind } from '../../domain/drag';
import { packRows } from '../../domain/packRows';
import { headerRows, PX_PER_DAY, unitRange } from '../../domain/scale';
import { visibleSpans, type TaskSpan } from '../../domain/spans';
import { startPointerDrag } from '../../hooks/pointerDrag';
import { usePrefs } from '../../store/prefsStore';
import { useDoc, useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { useUi } from '../../store/uiStore';
import { taskColor } from '../taskColor';
import { dayAt } from './layout';
import { TaskBar } from './TaskBar';
import { TimelineHeader } from './TimelineHeader';
import { useTimelineRange } from './useTimelineRange';
import styles from './timeline.module.css';

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 24;
const BAR_INSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;

export interface TimelineHandle {
  scrollToDay(day: DayIndex): void;
  focus(): void;
}

interface Range {
  start: DayIndex;
  end: DayIndex;
}

export function TimelineView({ ref }: { ref?: Ref<TimelineHandle> }) {
  const doc = useDoc();
  const zoom = usePrefs((s) => s.zoom);
  const pack = usePrefs((s) => s.packRows);
  const tagFilter = usePrefs((s) => s.tagFilter);
  const selectedId = useUi((s) => s.selectedId);
  const today = toDayIndex(todayISO());
  const { ref: scroller, st, sync, scrollToDay } = useTimelineRange(zoom, today);
  useImperativeHandle(
    ref,
    () => ({ scrollToDay, focus: () => scroller.current?.focus({ preventScroll: true }) }),
    [scrollToDay, scroller],
  );
  const { from, to, win } = st;
  const px = PX_PER_DAY[st.zoom];
  // Drag callbacks outlive the render that started them; the range may grow mid-drag.
  const live = useRef({ from, px });
  useLayoutEffect(() => {
    live.current = { from, px };
  });

  const grid = useRef<HTMLDivElement>(null);
  /** Dashed bar while drag-creating, kept until quick-create closes (TL-11). */
  const [draft, setDraft] = useState<(Range & { row: number }) | null>(null);
  /** Bar being moved or resized; it keeps its row until release (TL-13, TL-14). */
  const [preview, setPreview] = useState<(Range & { id: string }) | null>(null);

  // When quick-create closes, drop the draft and give focus back to the timeline (NF-4).
  useEffect(
    () =>
      useUi.subscribe((s, prev) => {
        if (!prev.quickCreate || s.quickCreate) return;
        setDraft(null);
        scroller.current?.focus({ preventScroll: true });
      }),
    [scroller],
  );

  const spans = useMemo(() => visibleSpans(doc, tagFilter), [doc, tagFilter]);
  const rows = useMemo(() => packRows(spans, pack), [spans, pack]);
  const { top, bottom } = useMemo(() => headerRows(st.zoom, win[0], win[1]), [st.zoom, win]);
  const x = (day: number) => (day - from) * px;

  const onGridPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only empty space: bars handle their own presses, everything else ignores the pointer.
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    e.preventDefault();
    const rect = () => grid.current!.getBoundingClientRect();
    const at = (clientX: number) =>
      dayAt(live.current.from, live.current.px, clientX - rect().left);
    const d0 = at(e.clientX);
    const row = Math.max(0, Math.floor((e.clientY - rect().top) / ROW_HEIGHT));
    const draftAt = (clientX: number) => {
      const [start, end] = rangeBetween(d0, at(clientX));
      return { start, end, row };
    };
    startPointerDrag(e, {
      onMove: (_dx, _dy, ev) => setDraft(draftAt(ev.clientX)),
      onEnd: (_dx, _dy, ev, moved) => {
        const [start, end] = moved ? rangeBetween(d0, at(ev.clientX)) : unitRange(st.zoom, d0);
        setDraft({ start, end, row });
        const g = rect();
        const { from, px } = live.current;
        // Opened after pointerup: the popover closes on any pointerdown outside it.
        useUi.getState().openQuickCreate({
          start: fromDayIndex(start),
          end: fromDayIndex(end),
          anchor: new DOMRect(
            g.left + (start - from) * px,
            g.top + row * ROW_HEIGHT + BAR_INSET,
            (end - start + 1) * px,
            BAR_HEIGHT,
          ),
        });
      },
      onCancel: () => setDraft(null),
    });
  };

  const open = (id: string) => {
    useUi.getState().select(id);
    useUi.getState().openEdit(id);
  };

  const onBarPointerDown = (e: PointerEvent<HTMLButtonElement>, s: TaskSpan) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = (e.target as HTMLElement).dataset.handle;
    const kind: DragKind =
      handle === 'start' ? 'resize-start' : handle === 'end' ? 'resize-end' : 'move';
    const bar = e.currentTarget;
    const dragged = (dx: number) => applyDrag(s, kind, Math.round(dx / live.current.px));
    startPointerDrag(e, {
      onMove: (dx) => setPreview({ id: s.id, ...dragged(dx) }),
      onEnd: (dx, _dy, _ev, moved) => {
        setPreview(null);
        if (!moved) {
          bar.focus(); // so the dialog hands focus back to the bar
          open(s.id);
          return;
        }
        const { start, end } = dragged(dx);
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

  return (
    <div
      ref={scroller}
      className={styles.scroller}
      onScroll={sync}
      tabIndex={0}
      role="region"
      aria-label="Timeline"
    >
      <div className={styles.content} style={{ width: (to - from) * px }}>
        <TimelineHeader top={top} bottom={bottom} from={from} px={px} />
        <div
          ref={grid}
          className={styles.grid}
          style={{ height: (rows.length + 1) * ROW_HEIGHT }}
          onPointerDown={onGridPointerDown}
        >
          {st.zoom === 'day' &&
            bottom
              .filter((c) => weekday(c.start) >= 5)
              .map((c) => (
                <div
                  key={`we${c.key}`}
                  className={styles.weekend}
                  style={{ left: x(c.start), width: px }}
                />
              ))}
          {bottom.map((c) => (
            <div key={c.key} className={styles.line} style={{ left: x(c.start) }} />
          ))}
          {today >= from && today < to && (
            <div className={styles.today} style={{ left: x(today) + px / 2 }} />
          )}
          {rows.flatMap((row, r) =>
            row.map((s) => {
              const p = preview?.id === s.id ? preview : s;
              if (p.end < from || p.start >= to) return null;
              const start = Math.max(p.start, from);
              const end = Math.min(p.end, to - 1);
              return (
                <TaskBar
                  key={s.id}
                  span={s}
                  left={x(start)}
                  width={(end - start + 1) * px}
                  top={r * ROW_HEIGHT + BAR_INSET}
                  color={taskColor(s.task, doc.tags)}
                  selected={s.id === selectedId}
                  tip={p === preview ? formatRange(p.start, p.end) : undefined}
                  onPointerDown={(e) => onBarPointerDown(e, s)}
                  onOpen={() => open(s.id)}
                />
              );
            }),
          )}
          {draft && (
            <div
              className={styles.draft}
              style={{
                left: x(draft.start),
                width: (draft.end - draft.start + 1) * px,
                top: draft.row * ROW_HEIGHT + BAR_INSET,
              }}
            >
              {formatRange(draft.start, draft.end)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

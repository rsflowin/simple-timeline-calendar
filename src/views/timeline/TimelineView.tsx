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
  formatMonthName,
  formatRange,
  fromDayIndex,
  parts,
  todayISO,
  toDayIndex,
  weekday,
  type DayIndex,
} from '../../domain/dates';
import { updateTask } from '../../domain/doc';
import { applyDrag, rangeBetween, type DayRange, type DragKind } from '../../domain/drag';
import { packRows } from '../../domain/packRows';
import { headerRows, PX_PER_DAY, unitRange } from '../../domain/scale';
import { visibleSpans, type TaskSpan } from '../../domain/spans';
import { startNonTaskDrag, startPointerDrag } from '../../hooks/pointerDrag';
import { usePrefs } from '../../store/prefsStore';
import { useDoc, useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { useAgendaDay, useUi } from '../../store/uiStore';
import { openTask } from '../openTask';
import { taskColor } from '../taskColor';
import { TagChip } from '../../components/TagChip';
import { centreDay, dayAt } from './layout';
import { TaskBar } from './TaskBar';
import { TimelineHeader } from './TimelineHeader';
import { useTimelineRange } from './useTimelineRange';
import styles from './timeline.module.css';

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 24;
const BAR_INSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
/** Tag header above each tag's rows (when group labels are on). */
const GROUP_HEAD = 24;
/** Days ‹ › moves the timeline, per zoom. */
const STEP_DAYS = { day: 7, week: 28, month: 91 } as const;

export interface TimelineHandle {
  scrollToDay(day: DayIndex): void;
  /** Move about one screenful-ish back or forward (toolbar ‹ ›). */
  step(dir: 1 | -1): void;
  focus(): void;
}

export function TimelineView({ ref }: { ref?: Ref<TimelineHandle> }) {
  const doc = useDoc();
  const zoom = usePrefs((s) => s.zoom);
  const pack = usePrefs((s) => s.packRows);
  const tagRowMode = usePrefs((s) => s.tagRowMode);
  const groupLabels = usePrefs((s) => s.groupLabels);
  const tagFilter = usePrefs((s) => s.tagFilter);
  const clickCreate = usePrefs((s) => s.clickCreate);
  const dragBehavior = usePrefs((s) => s.dragBehavior);
  const selectedId = useUi((s) => s.selectedId);
  const today = toDayIndex(todayISO());
  const { ref: scroller, st, sync, scrollToDay } = useTimelineRange(zoom, today);
  const selectedAgendaDay = useAgendaDay();
  const { from, to, win } = st;
  const px = PX_PER_DAY[st.zoom];
  // Drag callbacks outlive the render that started them; the range may grow mid-drag.
  const live = useRef({ from, px, zoom: st.zoom });
  useLayoutEffect(() => {
    live.current = { from, px, zoom: st.zoom };
  });
  const centre = () => {
    const el = scroller.current!;
    return centreDay(live.current.from, live.current.px, el.scrollLeft, el.clientWidth);
  };
  /** Tells the toolbar which month is in the middle of the screen. */
  const publishTitle = () => {
    const c = Math.floor(centre());
    useUi.getState().setTimelineTitle(`${formatMonthName(c)} ${parts(c).year}`);
  };
  // publishTitle reads only refs and the DOM; rerun whenever the range or zoom moves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(publishTitle, [st]);
  useImperativeHandle(ref, () => ({
    scrollToDay,
    step: (dir) => scrollToDay(Math.floor(centre()) + dir * STEP_DAYS[live.current.zoom]),
    focus: () => scroller.current?.focus({ preventScroll: true }),
  }));

  const grid = useRef<HTMLDivElement>(null);
  /** Dashed bar while drag-creating, kept until quick-create closes (TL-11). `top`: its row's y. */
  const [draft, setDraft] = useState<(DayRange & { top: number }) | null>(null);
  /** Bar being moved or resized; it keeps its row until release (TL-13, TL-14). */
  const [preview, setPreview] = useState<(DayRange & { id: string }) | null>(null);
  const [panning, setPanning] = useState(false);
  const isPanning = panning && dragBehavior === 'scroll';

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
  const tagOrder = useMemo(() => doc.tags.map((t) => t.id), [doc.tags]);
  const rows = useMemo(
    () => packRows(spans, pack, { tagOrder, tagOf: (s) => s.task.tagIds[0], mode: tagRowMode }),
    [spans, pack, tagOrder, tagRowMode],
  );
  // Headers only make sense when each row holds one tag: Pack rows on, one row per tag.
  const showGroups = groupLabels && pack && tagRowMode === 'dedicated';
  const layout = useMemo(() => {
    const tagsById = new Map(doc.tags.map((t) => [t.id, t]));
    const tops: number[] = [];
    const heads: { top: number; tagId: string }[] = [];
    let y = 0;
    let prev: string | null = null;
    for (const row of rows) {
      if (showGroups) {
        const id = row[0].task.tagIds[0];
        const tagId = id !== undefined && tagsById.has(id) ? id : '';
        if (tagId !== prev) {
          heads.push({ top: y, tagId });
          y += GROUP_HEAD;
          prev = tagId;
        }
      }
      tops.push(y);
      y += ROW_HEIGHT;
    }
    return { tops, heads, height: y, tagsById };
  }, [rows, showGroups, doc.tags]);
  /** y of the row slot under a point `py` px below the grid top; past the last row, empty slots. */
  const slotTop = (py: number) => {
    for (const t of layout.tops) if (py < t + ROW_HEIGHT) return t;
    return layout.height + Math.max(0, Math.floor((py - layout.height) / ROW_HEIGHT)) * ROW_HEIGHT;
  };
  const { top, bottom } = useMemo(() => headerRows(st.zoom, win[0], win[1]), [st.zoom, win]);
  const x = (day: number) => (day - from) * px;

  const openQuickCreateAt = (start: DayIndex, end: DayIndex, rowTop: number) => {
    setDraft({ start, end, top: rowTop });
    const g = grid.current!.getBoundingClientRect();
    const { from, px } = live.current;
    // Opened after pointerup: the popover closes on any pointerdown outside it.
    useUi.getState().openQuickCreate({
      start: fromDayIndex(start),
      end: fromDayIndex(end),
      anchor: new DOMRect(
        g.left + (start - from) * px,
        g.top + rowTop + BAR_INSET,
        (end - start + 1) * px,
        BAR_HEIGHT,
      ),
    });
  };

  const onGridPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only empty space: bars handle their own presses, everything else ignores the pointer.
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    if (!clickCreate && dragBehavior === 'none') return;
    e.preventDefault();
    const rect = () => grid.current!.getBoundingClientRect();
    const at = (clientX: number) =>
      dayAt(live.current.from, live.current.px, clientX - rect().left);
    const d0 = at(e.clientX);
    const row = slotTop(e.clientY - rect().top);
    if (dragBehavior !== 'task') {
      startNonTaskDrag(e, {
        scrollEl: scroller.current,
        pan: dragBehavior === 'scroll',
        onPanChange: setPanning,
        onClick: () => {
          if (!clickCreate) return;
          const [start, end] = unitRange(st.zoom, d0);
          openQuickCreateAt(start, end, row);
        },
      });
      return;
    }
    const draftAt = (clientX: number) => {
      const [start, end] = rangeBetween(d0, at(clientX));
      return { start, end, top: row };
    };
    startPointerDrag(e, {
      onMove: (_dx, _dy, ev) => setDraft(draftAt(ev.clientX)),
      onEnd: (_dx, _dy, ev, moved) => {
        if (!moved && !clickCreate) return;
        const [start, end] = moved ? rangeBetween(d0, at(ev.clientX)) : unitRange(st.zoom, d0);
        openQuickCreateAt(start, end, row);
      },
      onCancel: () => setDraft(null),
    });
  };

  const onBarPointerDown = (e: PointerEvent<HTMLButtonElement>, s: TaskSpan) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const bar = e.currentTarget;
    if (dragBehavior !== 'task') {
      startNonTaskDrag(e, {
        scrollEl: scroller.current,
        pan: dragBehavior === 'scroll',
        onPanChange: setPanning,
        onClick: () => {
          bar.focus(); // so the dialog hands focus back to the bar
          openTask(s.id);
        },
      });
      return;
    }
    const handle = (e.target as HTMLElement).dataset.handle;
    const kind: DragKind =
      handle === 'start' ? 'resize-start' : handle === 'end' ? 'resize-end' : 'move';
    const dragged = (dx: number) => applyDrag(s, kind, Math.round(dx / live.current.px));
    startPointerDrag(e, {
      onMove: (dx) => setPreview({ id: s.id, ...dragged(dx) }),
      onEnd: (dx, _dy, _ev, moved) => {
        setPreview(null);
        if (!moved) {
          bar.focus(); // so the dialog hands focus back to the bar
          openTask(s.id);
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
      data-drag={dragBehavior}
      data-click-create={clickCreate ? undefined : 'off'}
      data-panning={isPanning ? 'true' : undefined}
      onScroll={() => {
        sync();
        publishTitle();
      }}
      tabIndex={0}
      role="region"
      aria-label="Timeline"
    >
      <div className={styles.content} style={{ width: (to - from) * px }}>
        <TimelineHeader
          top={top}
          bottom={bottom}
          from={from}
          px={px}
          isDayZoom={st.zoom === 'day'}
          today={st.zoom === 'day' ? today : undefined}
          selectedDay={selectedAgendaDay}
          onSelectDay={(d) => useUi.getState().openAgendaFor(fromDayIndex(d))}
        />
        <div
          ref={grid}
          className={styles.grid}
          style={{ height: layout.height + ROW_HEIGHT }}
          onPointerDown={onGridPointerDown}
        >
          {layout.heads.map(({ top, tagId }) => {
            const tag = layout.tagsById.get(tagId);
            return (
              <div key={`g${tagId}`} className={styles.groupHead} style={{ top }}>
                <span className={styles.groupLabel}>{tag ? <TagChip tag={tag} /> : 'No tag'}</span>
              </div>
            );
          })}
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
          {selectedAgendaDay !== undefined &&
            selectedAgendaDay !== today &&
            selectedAgendaDay >= from &&
            selectedAgendaDay < to && (
              <div className={styles.agendaLine} style={{ left: x(selectedAgendaDay) + px / 2 }} />
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
                  top={layout.tops[r] + BAR_INSET}
                  color={taskColor(s.task, doc.tags)}
                  selected={s.id === selectedId}
                  canDrag={dragBehavior === 'task'}
                  tip={p === preview ? formatRange(p.start, p.end) : undefined}
                  onPointerDown={(e) => onBarPointerDown(e, s)}
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
                top: draft.top + BAR_INSET,
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

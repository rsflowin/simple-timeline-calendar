import { useImperativeHandle, useMemo, type Ref } from 'react';
import { todayISO, toDayIndex, weekday, type DayIndex } from '../../domain/dates';
import { packRows } from '../../domain/packRows';
import { headerRows, PX_PER_DAY } from '../../domain/scale';
import { visibleSpans } from '../../domain/spans';
import { usePrefs } from '../../store/prefsStore';
import { useDoc } from '../../store/roadmapStore';
import { taskColor } from '../taskColor';
import { TaskBar } from './TaskBar';
import { TimelineHeader } from './TimelineHeader';
import { useTimelineRange } from './useTimelineRange';
import styles from './timeline.module.css';

export const ROW_HEIGHT = 32;
const BAR_INSET = 4; // (ROW_HEIGHT - bar height 24) / 2

export interface TimelineHandle {
  scrollToDay(day: DayIndex): void;
}

export function TimelineView({ ref }: { ref?: Ref<TimelineHandle> }) {
  const doc = useDoc();
  const zoom = usePrefs((s) => s.zoom);
  const pack = usePrefs((s) => s.packRows);
  const tagFilter = usePrefs((s) => s.tagFilter);
  const today = toDayIndex(todayISO());
  const { ref: scroller, st, sync, scrollToDay } = useTimelineRange(zoom, today);
  useImperativeHandle(ref, () => ({ scrollToDay }), [scrollToDay]);
  const { from, to, win } = st;
  const px = PX_PER_DAY[st.zoom];

  const spans = useMemo(() => visibleSpans(doc, tagFilter), [doc, tagFilter]);
  const rows = useMemo(() => packRows(spans, pack), [spans, pack]);
  const { top, bottom } = useMemo(() => headerRows(st.zoom, win[0], win[1]), [st.zoom, win]);
  const x = (day: number) => (day - from) * px;

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
        <div className={styles.grid} style={{ height: (rows.length + 1) * ROW_HEIGHT }}>
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
            row
              .filter((s) => s.end >= from && s.start < to)
              .map((s) => {
                const start = Math.max(s.start, from);
                const end = Math.min(s.end, to - 1);
                return (
                  <TaskBar
                    key={s.id}
                    span={s}
                    left={x(start)}
                    width={(end - start + 1) * px}
                    top={r * ROW_HEIGHT + BAR_INSET}
                    color={taskColor(s.task, doc.tags)}
                  />
                );
              }),
          )}
        </div>
      </div>
    </div>
  );
}

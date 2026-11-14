import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { todayISO, toDayIndex, weekday } from '../../domain/dates';
import { packRows } from '../../domain/packRows';
import { headerRows, PX_PER_DAY } from '../../domain/scale';
import { visibleSpans } from '../../domain/spans';
import { usePrefs } from '../../store/prefsStore';
import { useDoc } from '../../store/roadmapStore';
import { taskColor } from '../taskColor';
import { headerWindow, rangeAround, type Range } from './layout';
import { TaskBar } from './TaskBar';
import { TimelineHeader } from './TimelineHeader';
import styles from './timeline.module.css';

export const ROW_HEIGHT = 32;
const BAR_INSET = 4; // (ROW_HEIGHT - bar height 24) / 2

export function TimelineView() {
  const doc = useDoc();
  const zoom = usePrefs((s) => s.zoom);
  const pack = usePrefs((s) => s.packRows);
  const tagFilter = usePrefs((s) => s.tagFilter);
  const px = PX_PER_DAY[zoom];
  const today = toDayIndex(todayISO());
  const [from, to] = useMemo(() => rangeAround(zoom, today), [zoom, today]);

  const ref = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState<Range>([from, from]);
  const measure = useCallback(() => {
    const el = ref.current!;
    const next = headerWindow(zoom, from, to, el.scrollLeft, el.clientWidth);
    setWin((w) => (w[0] === next[0] && w[1] === next[1] ? w : next));
  }, [zoom, from, to]);
  useLayoutEffect(measure, [measure]);

  const spans = useMemo(() => visibleSpans(doc, tagFilter), [doc, tagFilter]);
  const rows = useMemo(() => packRows(spans, pack), [spans, pack]);
  const { top, bottom } = useMemo(() => headerRows(zoom, win[0], win[1]), [zoom, win]);
  const x = (day: number) => (day - from) * px;

  return (
    <div
      ref={ref}
      className={styles.scroller}
      onScroll={measure}
      tabIndex={0}
      role="region"
      aria-label="Timeline"
    >
      <div className={styles.content} style={{ width: (to - from) * px }}>
        <TimelineHeader top={top} bottom={bottom} from={from} px={px} />
        <div className={styles.grid} style={{ height: (rows.length + 1) * ROW_HEIGHT }}>
          {zoom === 'day' &&
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

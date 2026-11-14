import { useLayoutEffect, useRef, useState } from 'react';
import { monthWeeks } from '../../domain/calendar';
import { formatWeekday, parts, type DayIndex } from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { laneFit } from './layout';
import { WeekRow } from './WeekRow';
import styles from './calendar.module.css';

/** CAL-1 … CAL-4: the 4–6 Monday-first weeks covering the cursor's month. */
export function MonthView({ cursor, spans }: { cursor: DayIndex; spans: readonly TaskSpan[] }) {
  const { year, month } = parts(cursor);
  const weeks = monthWeeks(year, month);
  const body = useRef<HTMLDivElement>(null);
  /** Undefined until measured: rows are not capped (also in jsdom, which has no ResizeObserver). */
  const [rowHeight, setRowHeight] = useState<number>();

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const el = body.current!;
    const ro = new ResizeObserver(() => setRowHeight(el.clientHeight / weeks.length));
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

  return (
    <div className={styles.month}>
      <div className={styles.weekdays}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i}>{formatWeekday(weeks[0] + i)}</div>
        ))}
      </div>
      <div ref={body} className={styles.weeks}>
        {weeks.map((w) => (
          <WeekRow
            key={w}
            weekStart={w}
            spans={spans}
            maxLanes={rowHeight === undefined ? undefined : laneFit(rowHeight)}
            dimOutside={{ year, month }}
          />
        ))}
      </div>
    </div>
  );
}

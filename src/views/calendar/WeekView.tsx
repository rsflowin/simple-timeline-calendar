import {
  formatWeekday,
  parts,
  startOfWeek,
  todayISO,
  toDayIndex,
  type DayIndex,
} from '../../domain/dates';
import type { CalendarGestures } from './useCalendarGestures';
import { WeekRow } from './WeekRow';
import styles from './calendar.module.css';

/** CAL-7, CAL-8: the cursor's Mon–Sun week as one uncapped row with `Mon 9` headers. */
export function WeekView({ cursor, g }: { cursor: DayIndex; g: CalendarGestures }) {
  const start = startOfWeek(cursor);
  const today = toDayIndex(todayISO());
  return (
    <div className={styles.week}>
      <div className={styles.weekdays}>
        {Array.from({ length: 7 }, (_, i) => start + i).map((d) => (
          <div key={d} className={d === today ? styles.todayHead : undefined}>
            {formatWeekday(d)} <span className={styles.headDate}>{parts(d).date}</span>
          </div>
        ))}
      </div>
      <div className={styles.weekBody} data-scroll-container="">
        <WeekRow
          weekStart={start}
          spans={g.spans}
          details
          draggingId={g.draggingId}
          canDrag={g.canDragTask}
          onBarPointerDown={g.onBarPointerDown}
        />
      </div>
    </div>
  );
}

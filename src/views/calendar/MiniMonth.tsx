import { monthWeeks } from '../../domain/calendar';
import {
  dayOf,
  formatMonthDay,
  formatMonthName,
  formatWeekday,
  fromDayIndex,
  parts,
  type DayIndex,
} from '../../domain/dates';
import { usePrefs } from '../../store/prefsStore';
import styles from './calendar.module.css';

interface Props {
  year: number;
  month: number;
  today: DayIndex;
  /** Tasks per day (CAL-10). */
  counts: ReadonlyMap<DayIndex, number>;
  onDay(day: DayIndex, el: HTMLElement): void;
}

/** One Mon-first month grid of the Year view (CAL-9 … CAL-12). */
export function MiniMonth({ year, month, today, counts, onDay }: Props) {
  const setPrefs = usePrefs((s) => s.set);
  const first = dayOf(year, month);
  const weeks = monthWeeks(year, month);
  const days = weeks.flatMap((w) => Array.from({ length: 7 }, (_, i) => w + i));

  return (
    <section>
      <button
        type="button"
        className={styles.miniName}
        onClick={() => setPrefs({ calendarMode: 'month', cursor: fromDayIndex(first) })}
      >
        {formatMonthName(first)}
      </button>
      <div className={styles.miniGrid}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`h${i}`}>{formatWeekday(weeks[0] + i).slice(0, 2)}</span>
        ))}
        {days.map((d) => {
          if (parts(d).month !== month) return <span key={d} />;
          const n = counts.get(d) ?? 0;
          return (
            <button
              key={d}
              type="button"
              className={`${styles.miniDay} ${d === today ? styles.today : ''}`}
              data-level={Math.min(n, 3) || undefined}
              aria-label={`${formatMonthDay(d)}, ${n} task${n === 1 ? '' : 's'}`}
              onClick={(e) => onDay(d, e.currentTarget)}
            >
              {parts(d).date}
            </button>
          );
        })}
      </div>
    </section>
  );
}

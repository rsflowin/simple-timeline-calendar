import { useMemo } from 'react';
import { tasksPerDay } from '../../domain/calendar';
import {
  dayOf,
  fromDayIndex,
  parts,
  todayISO,
  toDayIndex,
  type DayIndex,
} from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { useAgendaDay, useUi } from '../../store/uiStore';
import { MiniMonth } from './MiniMonth';
import styles from './calendar.module.css';

/** CAL-9 … CAL-12: twelve mini-months shaded by how many tasks cover each day. */
export function YearView({ cursor, spans }: { cursor: DayIndex; spans: readonly TaskSpan[] }) {
  const { year } = parts(cursor);
  const today = toDayIndex(todayISO());
  const agendaDay = useAgendaDay();
  const counts = useMemo(
    () => tasksPerDay(spans, dayOf(year, 0, 1), dayOf(year + 1, 0, 1)),
    [spans, year],
  );

  return (
    <div className={styles.year}>
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          today={today}
          selectedDay={agendaDay}
          counts={counts}
          onDay={(day) => useUi.getState().openAgendaFor(fromDayIndex(day))}
        />
      ))}
    </div>
  );
}

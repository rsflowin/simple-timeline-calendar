import { useMemo, useState } from 'react';
import { Popover } from '../../components/Popover';
import { tasksPerDay } from '../../domain/calendar';
import {
  dayOf,
  formatMonthDay,
  fromDayIndex,
  parts,
  todayISO,
  toDayIndex,
  type DayIndex,
} from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { useUi } from '../../store/uiStore';
import { MiniMonth } from './MiniMonth';
import { openTask } from '../openTask';
import { DayTasks } from './WeekRow';
import styles from './calendar.module.css';

/** CAL-9 … CAL-12: twelve mini-months shaded by how many tasks cover each day. */
export function YearView({ cursor, spans }: { cursor: DayIndex; spans: readonly TaskSpan[] }) {
  const { year } = parts(cursor);
  const today = toDayIndex(todayISO());
  const counts = useMemo(
    () => tasksPerDay(spans, dayOf(year, 0, 1), dayOf(year + 1, 0, 1)),
    [spans, year],
  );
  const [open, setOpen] = useState<{ day: DayIndex; el: HTMLElement; anchor: DOMRect } | null>(
    null,
  );

  return (
    <div className={styles.year}>
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          today={today}
          counts={counts}
          onDay={(day, el) => setOpen({ day, el, anchor: el.getBoundingClientRect() })}
        />
      ))}
      {open && (
        <Popover
          anchor={open.anchor}
          label={`Tasks on ${formatMonthDay(open.day)}`}
          onClose={() => {
            open.el.focus(); // Esc / outside click: back to the day (NF-4)
            setOpen(null);
          }}
        >
          <div className={styles.dayHead}>{formatMonthDay(open.day)}</div>
          <DayTasks
            day={open.day}
            spans={spans}
            onPick={(id) => {
              open.el.focus(); // the dialog hands focus back here, not to <body>
              setOpen(null);
              openTask(id);
            }}
          />
          <button
            type="button"
            className={styles.addTask}
            onClick={() => {
              setOpen(null);
              const iso = fromDayIndex(open.day);
              useUi.getState().openQuickCreate({ start: iso, end: iso, anchor: open.anchor });
            }}
          >
            + Add task
          </button>
        </Popover>
      )}
    </div>
  );
}

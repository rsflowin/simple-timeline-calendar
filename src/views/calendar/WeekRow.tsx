import { useMemo, useState } from 'react';
import { Popover } from '../../components/Popover';
import { hiddenCounts, weekLanes } from '../../domain/calendar';
import {
  formatMonthDay,
  formatRange,
  parts,
  todayISO,
  toDayIndex,
  type DayIndex,
} from '../../domain/dates';
import type { TaskSpan } from '../../domain/spans';
import { usePrefs } from '../../store/prefsStore';
import { useDoc } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { taskColor } from '../taskColor';
import { DATE_HEIGHT, LANE_HEIGHT, shownLanes } from './layout';
import { openTask } from './openTask';
import styles from './calendar.module.css';

interface Props {
  weekStart: DayIndex;
  spans: readonly TaskSpan[];
  /** Lanes that fit; more become `+N more` (CAL-4). Undefined = no cap. */
  maxLanes?: number;
  /** Dim days outside this month (CAL-1). */
  dimOutside?: { year: number; month: number };
}

const pct = (days: number) => `${(days / 7) * 100}%`;

/** One Mon–Sun row: day cells (`data-day`) with this week's pieces of the tasks on top (CAL-2, CAL-3). */
export function WeekRow({ weekStart, spans, maxLanes, dimOutside }: Props) {
  const pack = usePrefs((s) => s.packRows);
  const tags = useDoc().tags;
  const selectedId = useUi((s) => s.selectedId);
  const today = toDayIndex(todayISO());
  const lanes = useMemo(() => weekLanes(spans, weekStart, pack), [spans, weekStart, pack]);
  const shown = shownLanes(lanes.length, maxLanes);
  const hidden = shown < lanes.length ? hiddenCounts(lanes, shown, weekStart) : [];
  const [more, setMore] = useState<{ day: DayIndex; el: HTMLElement; anchor: DOMRect } | null>(
    null,
  );
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i);

  return (
    <div className={styles.row}>
      <div className={styles.cells}>
        {days.map((d) => {
          const p = parts(d);
          const outside =
            dimOutside && (p.month !== dimOutside.month || p.year !== dimOutside.year);
          const cls = [styles.cell, outside && styles.outside, d === today && styles.today];
          return (
            <div key={d} data-day={d} className={cls.filter(Boolean).join(' ')}>
              <span className={styles.date}>{p.date}</span>
            </div>
          );
        })}
      </div>
      {lanes.slice(0, shown).flatMap((lane, i) =>
        lane.map((seg) => {
          const s = seg.item;
          const label = `${s.task.title}, ${formatRange(s.start, s.end)}`;
          const inL = seg.startsHere ? 2 : 0;
          const inR = seg.endsHere ? 2 : 0;
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.bar} ${s.id === selectedId ? styles.selected : ''}`}
              data-starts-here={seg.startsHere || undefined}
              data-ends-here={seg.endsHere || undefined}
              style={{
                left: `calc(${pct(seg.start - weekStart)} + ${inL}px)`,
                width: `calc(${pct(seg.end - seg.start + 1)} - ${inL + inR}px)`,
                top: DATE_HEIGHT + i * LANE_HEIGHT,
                ...taskColor(s.task, tags),
              }}
              aria-label={label}
              title={label}
              onClick={() => openTask(s.id)}
            >
              <span className={styles.barLabel}>{s.task.title}</span>
            </button>
          );
        }),
      )}
      {hidden.map(
        (n, i) =>
          n > 0 && (
            <button
              key={`more${i}`}
              type="button"
              className={styles.more}
              style={{
                left: `calc(${pct(i)} + 2px)`,
                width: `calc(${pct(1)} - 4px)`,
                top: DATE_HEIGHT + shown * LANE_HEIGHT,
              }}
              aria-label={`${n} more on ${formatMonthDay(days[i])}`}
              onClick={(e) => {
                const el = e.currentTarget;
                setMore({ day: days[i], el, anchor: el.getBoundingClientRect() });
              }}
            >
              +{n} more
            </button>
          ),
      )}
      {more && (
        <Popover
          anchor={more.anchor}
          label={`Tasks on ${formatMonthDay(more.day)}`}
          onClose={() => setMore(null)}
        >
          <DayTasks
            day={more.day}
            spans={spans}
            onPick={(id) => {
              more.el.focus(); // the dialog hands focus back here, not to <body>
              setMore(null);
              openTask(id);
            }}
          />
        </Popover>
      )}
    </div>
  );
}

/** Tasks covering `day`, as buttons (CAL-4, CAL-11). */
export function DayTasks({
  day,
  spans,
  onPick,
}: {
  day: DayIndex;
  spans: readonly TaskSpan[];
  onPick(id: string): void;
}) {
  const tags = useDoc().tags;
  return (
    <ul className={styles.dayTasks}>
      {spans
        .filter((s) => s.start <= day && s.end >= day)
        .map((s) => (
          <li key={s.id}>
            <button
              type="button"
              style={taskColor(s.task, tags)}
              title={`${s.task.title}, ${formatRange(s.start, s.end)}`}
              onClick={() => onPick(s.id)}
            >
              {s.task.title}
            </button>
          </li>
        ))}
    </ul>
  );
}

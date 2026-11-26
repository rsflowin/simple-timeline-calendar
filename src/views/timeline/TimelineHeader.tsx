import { useState, type MouseEvent } from 'react';
import { formatMonthDay, formatWeekday, type DayIndex } from '../../domain/dates';
import type { HeaderCell } from '../../domain/scale';
import { dayAt } from './layout';
import styles from './timeline.module.css';

interface Props {
  top: HeaderCell[];
  bottom: HeaderCell[];
  from: number;
  px: number;
  isDayZoom: boolean;
  /** Day zoom: today's cell gets the same red date pill as the calendar. */
  today?: number;
  /** Currently inspected agenda day, highlighted in Day zoom. */
  selectedDay?: number;
  /** Clicking anywhere on the header opens that day's agenda briefing. */
  onSelectDay(day: DayIndex): void;
}

/** Renders cell label with Today / selected Agenda pill formatting. */
function cellContent(label: string, isDayZoom: boolean, isToday: boolean, isSelected: boolean) {
  if (isToday) {
    return (
      <span className={`${styles.todayDate} ${isSelected ? styles.agendaActive : ''}`}>{label}</span>
    );
  }
  if (isSelected && isDayZoom) {
    return <span className={styles.agendaDate}>{label}</span>;
  }
  return label;
}

/** Two sticky header rows; cells are absolutely placed on the timeline's scale. */
export function TimelineHeader({
  top,
  bottom,
  from,
  px,
  isDayZoom,
  today,
  selectedDay,
  onSelectDay,
}: Props) {
  const [hoverDay, setHoverDay] = useState<DayIndex | null>(null);
  const [prevDayZoom, setPrevDayZoom] = useState(isDayZoom);
  if (prevDayZoom !== isDayZoom) {
    setPrevDayZoom(isDayZoom);
    if (hoverDay !== null) setHoverDay(null);
  }
  const place = (c: HeaderCell) => ({ left: (c.start - from) * px, width: c.days * px });
  const dayFromEvent = (e: MouseEvent<HTMLDivElement>): DayIndex =>
    dayAt(from, px, e.clientX - e.currentTarget.getBoundingClientRect().left);

  return (
    <div
      className={`${styles.header} ${!isDayZoom ? styles.headerPickable : ''}`}
      onClick={(e) => {
        if (isDayZoom) return;
        onSelectDay(dayFromEvent(e));
      }}
      onMouseMove={!isDayZoom ? (e) => setHoverDay(dayFromEvent(e)) : undefined}
      onMouseLeave={!isDayZoom ? () => setHoverDay(null) : undefined}
    >
      <div className={styles.headerRow}>
        {top.map((c) => (
          <div key={c.key} className={styles.cell} style={place(c)}>
            <span className={styles.stickyLabel}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.headerRow}>
        {bottom.map((c) => {
          const isToday = c.start === today;
          const isSelected = c.start === selectedDay;
          const content = cellContent(c.label, isDayZoom, isToday, isSelected);
          return isDayZoom ? (
            <button
              key={c.key}
              type="button"
              tabIndex={-1}
              className={`${styles.cell} ${styles.dayCell}`}
              style={place(c)}
              aria-label={`Agenda for ${formatWeekday(c.start)}, ${formatMonthDay(c.start)}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(c.start)}
            >
              {content}
            </button>
          ) : (
            <div key={c.key} className={styles.cell} style={place(c)}>
              {content}
            </div>
          );
        })}
      </div>
      {!isDayZoom && hoverDay !== null && (
        <div
          className={styles.hoverTip}
          style={{ left: (hoverDay - from) * px + px / 2 }}
          aria-hidden="true"
        >
          {formatWeekday(hoverDay)}, {formatMonthDay(hoverDay)}
        </div>
      )}
    </div>
  );
}

import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { toDayIndex } from '../../domain/dates';
import { visibleSpans } from '../../domain/spans';
import { usePrefs } from '../../store/prefsStore';
import { useDoc } from '../../store/roadmapStore';
import { MonthView } from './MonthView';
import { useCalendarGestures } from './useCalendarGestures';
import styles from './calendar.module.css';

export interface CalendarHandle {
  focus(): void;
}

/** The calendar body for the current mode; the nav bar lives in the toolbar (UI-3). */
export function CalendarView({ ref }: { ref?: Ref<CalendarHandle> }) {
  const doc = useDoc();
  const tagFilter = usePrefs((s) => s.tagFilter);
  const mode = usePrefs((s) => s.calendarMode);
  const cursor = toDayIndex(usePrefs((s) => s.cursor));
  const box = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    ref,
    () => ({ focus: () => box.current?.focus({ preventScroll: true }) }),
    [],
  );
  const spans = useMemo(() => visibleSpans(doc, tagFilter), [doc, tagFilter]);
  const g = useCalendarGestures(spans, box);

  return (
    <div
      ref={box}
      className={styles.calendar}
      tabIndex={0}
      role="region"
      aria-label="Calendar"
      onPointerDown={g.onEmptyPointerDown}
    >
      {mode === 'month' && <MonthView cursor={cursor} g={g} />}
    </div>
  );
}

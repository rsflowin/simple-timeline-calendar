import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DayIndex } from '../../domain/dates';
import { PX_PER_DAY, timelineRange, type Zoom } from '../../domain/scale';
import { centreDay, rangeAround, scrollLeftFor, settle, type RangeState } from './layout';

/**
 * The timeline's rendered day range and its scroller: grows near the edges (TL-1), keeps the
 * centre date on zoom (TL-5) and centres a day on demand (TL-6). Render with `st.zoom`, not
 * `zoom`: the zoom switch happens one commit later, after the old centre has been read.
 */
export function useTimelineRange(zoom: Zoom, initialDay: DayIndex) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState<RangeState>(() => {
    const [from, to] = rangeAround(zoom, initialDay);
    return { zoom, from, to, win: [from, from] };
  });
  /** Day to centre after the next commit; null keeps the current scroll position. */
  const centre = useRef<number | null>(initialDay + 0.5);
  /** `from` the DOM was last laid out with, to keep the view still when the left edge grows. */
  const shown = useRef(st.from);

  useLayoutEffect(() => {
    const el = ref.current!;
    const px = PX_PER_DAY[st.zoom];
    const left =
      centre.current === null
        ? el.scrollLeft + (shown.current - st.from) * px
        : scrollLeftFor(centre.current, st.from, px, el.clientWidth);
    shown.current = st.from;
    const next = settle(st, left, el.clientWidth);
    if (next !== st) {
      // `left` may be off the track (e.g. negative) until the range has grown, so keep it as a date.
      centre.current = centreDay(st.from, px, left, el.clientWidth);
      setSt(next);
      return;
    }
    centre.current = null;
    if (el.scrollLeft !== left) el.scrollLeft = left;
  }, [st]);

  useLayoutEffect(() => {
    if (zoom === st.zoom) return;
    const el = ref.current!;
    const day = centreDay(st.from, PX_PER_DAY[st.zoom], el.scrollLeft, el.clientWidth);
    const [from, to] = timelineRange(zoom, st.from, st.to - 1);
    const left = scrollLeftFor(day, from, PX_PER_DAY[zoom], el.clientWidth);
    centre.current = day;
    setSt(settle({ zoom, from, to, win: [from, from] }, left, el.clientWidth));
  }, [zoom, st]);

  /** Call on scroll and resize. */
  const sync = useCallback(() => {
    const el = ref.current;
    if (el) setSt((s) => settle(s, el.scrollLeft, el.clientWidth));
  }, []);

  useEffect(() => {
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  /** Centres `day`; a day outside the range re-centres the range instead of stretching it. */
  const scrollToDay = useCallback((day: DayIndex) => {
    centre.current = day + 0.5;
    setSt((s) => {
      // A new object even when the range fits, so the layout effect runs and applies `centre`.
      if (day >= s.from && day < s.to) return { ...s };
      const [from, to] = rangeAround(s.zoom, day);
      return { ...s, from, to };
    });
  }, []);

  return { ref, st, sync, scrollToDay };
}

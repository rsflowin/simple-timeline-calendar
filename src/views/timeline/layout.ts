import type { DayIndex } from '../../domain/dates';
import { PX_PER_DAY, timelineRange, type Zoom } from '../../domain/scale';

export type Range = [from: DayIndex, to: DayIndex];

/** About 6 months before `day` and 12 after. Never derived from the tasks: they span 1900–2199. */
export function rangeAround(zoom: Zoom, day: DayIndex): Range {
  return timelineRange(zoom, day - 183, day + 365);
}

/** Days needing header cells and grid lines: the viewport ± one viewport width, unit-aligned. */
export function headerWindow(
  zoom: Zoom,
  from: DayIndex,
  to: DayIndex,
  scrollLeft: number,
  clientWidth: number,
): Range {
  const px = PX_PER_DAY[zoom];
  const [a, b] = timelineRange(
    zoom,
    from + Math.floor((scrollLeft - clientWidth) / px),
    from + Math.ceil((scrollLeft + 2 * clientWidth) / px),
  );
  return [Math.max(from, a), Math.min(to, b)];
}

/** Day (fractional) at the horizontal centre of the viewport. */
export const centreDay = (from: DayIndex, px: number, scrollLeft: number, clientWidth: number) =>
  from + (scrollLeft + clientWidth / 2) / px;

/** scrollLeft that puts `day` (fractional) at the centre of the viewport. */
export const scrollLeftFor = (day: number, from: DayIndex, px: number, clientWidth: number) =>
  (day - from) * px - clientWidth / 2;

export interface RangeState {
  zoom: Zoom;
  from: DayIndex;
  to: DayIndex;
  /** headerWindow for the current scroll position. */
  win: Range;
}

/**
 * State for a view at `scrollLeft` (relative to `st.from`): grows the range by ~6 months at a
 * time until a whole viewport is left on each side (TL-1), never shrinks it, and updates the
 * header window. Returns `st` itself when nothing changes.
 */
export function settle(st: RangeState, scrollLeft: number, clientWidth: number): RangeState {
  const px = PX_PER_DAY[st.zoom];
  let { from, to } = st;
  while (scrollLeft + (st.from - from) * px < clientWidth)
    from = timelineRange(st.zoom, from - 183, from)[0];
  const left = scrollLeft + (st.from - from) * px;
  while ((to - from) * px < left + 2 * clientWidth) to = timelineRange(st.zoom, to, to + 183)[1];
  const win = headerWindow(st.zoom, from, to, left, clientWidth);
  return from === st.from && to === st.to && win[0] === st.win[0] && win[1] === st.win[1]
    ? st
    : { ...st, from, to, win };
}

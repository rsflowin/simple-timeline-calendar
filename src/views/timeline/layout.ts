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

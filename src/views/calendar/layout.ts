/** Month view row geometry: the date number line, then bar lanes. */
export const DATE_HEIGHT = 24;
export const LANE_HEIGHT = 22;

/** Lanes that fit in a month row `height` px tall; at least one. */
export const laneFit = (height: number) =>
  Math.max(1, Math.floor((height - DATE_HEIGHT) / LANE_HEIGHT));

/** Lanes to draw: all when they fit (or `fit` is undefined), else one fewer, for `+N more` (CAL-4). */
export const shownLanes = (lanes: number, fit: number | undefined) =>
  fit === undefined || lanes <= fit ? lanes : fit - 1;

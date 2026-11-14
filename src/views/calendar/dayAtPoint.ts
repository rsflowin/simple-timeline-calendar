import type { DayIndex } from '../../domain/dates';

/** Day of the `data-day` cell under a viewport point, seeing through bars on top of it. */
export function dayAtPoint(x: number, y: number): DayIndex | null {
  const cell = document
    .elementsFromPoint(x, y)
    .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.day !== undefined);
  return cell ? Number(cell.dataset.day) : null;
}

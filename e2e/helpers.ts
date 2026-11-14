import type { Page } from '@playwright/test';

/** "Today" for every test, so dates in labels are deterministic. */
export const TODAY = '2026-11-13';

/** Pins the clock (timers keep running) and opens the app on a clean profile. */
export async function openApp(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.goto('/');
}

/** Same day numbering as `toDayIndex` in src/domain/dates.ts (the cells' `data-day`). */
export const dayIndex = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** A real pointer drag: press, move in steps, release. */
export async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
}

import type { Page } from '@playwright/test';

/** "Today" for every test, so dates in labels are deterministic. */
export const TODAY = '2026-11-13';

const EMPTY_ROADMAP = JSON.stringify({
  format: 'timeline-calendar',
  version: 1,
  tasks: [],
  tags: [],
});

/** Pins the clock (timers keep running), seeds server state, and opens the app. */
export async function openApp(page: Page, initialRoadmap = EMPTY_ROADMAP) {
  const res = await page.request.put('/api/roadmap', {
    headers: { 'Content-Type': 'application/json' },
    data: initialRoadmap,
  });
  if (!res.ok()) throw new Error(`Failed to seed roadmap: ${res.status()}`);
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

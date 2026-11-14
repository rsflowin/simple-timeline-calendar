import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { drag, openApp } from './helpers.ts';

const DAY_PX = 32; // PX_PER_DAY.day
const HEADER_PX = 49; // two 24px header rows + border

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Day' }).click();
});

/** Viewport point at the middle of the day `offset` days from today, in row `row`. Today is centred on load. */
async function dayPoint(page: Page, offset: number, row = 0): Promise<[number, number]> {
  const box = await page.getByRole('region', { name: 'Timeline' }).evaluate((el) => ({
    x: el.getBoundingClientRect().left + el.clientWidth / 2,
    y: el.getBoundingClientRect().top,
  }));
  return [box.x + offset * DAY_PX, box.y + HEADER_PX + row * 32 + 16];
}

/** Drag across days `from`..`to` (offsets from today) and name the task in quick-create. */
async function createTask(page: Page, from: number, to: number, title: string) {
  await drag(page, await dayPoint(page, from), await dayPoint(page, to));
  const input = page.getByRole('dialog', { name: 'New task' }).getByLabel('Task title');
  await input.fill(title);
  await input.press('Enter');
}

test('drag across 3 days creates a task through quick-create', async ({ page }) => {
  await createTask(page, 0, 2, 'Design');
  await expect(page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();
});

test('moving a bar 2 days right shifts it, and Ctrl+Z puts it back', async ({ page }) => {
  await createTask(page, 0, 2, 'Design');
  const bar = page.getByRole('button', { name: /^Design, / });
  await expect(bar).toHaveAccessibleName('Design, Nov 13 – Nov 15');

  const box = (await bar.boundingBox())!;
  const centre: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];
  await drag(page, centre, [centre[0] + 2 * DAY_PX, centre[1]]);
  await expect(bar).toHaveAccessibleName('Design, Nov 15 – Nov 17');

  await page.keyboard.press('Control+z');
  await expect(bar).toHaveAccessibleName('Design, Nov 13 – Nov 15');
});

test('pack rows puts non-overlapping tasks on one row; unpacked they get their own', async ({
  page,
}) => {
  await createTask(page, 0, 1, 'Alpha');
  await createTask(page, 3, 4, 'Beta');
  const alpha = page.getByRole('button', { name: /^Alpha, / });
  const beta = page.getByRole('button', { name: /^Beta, / });
  const top = async () => [(await alpha.boundingBox())!.y, (await beta.boundingBox())!.y];

  await expect(page.getByRole('button', { name: 'Pack rows' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const [a, b] = await top();
  expect(a).toBe(b);

  await page.getByRole('button', { name: 'Pack rows' }).click();
  await expect(page.getByRole('button', { name: 'Pack rows' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const [a2, b2] = await top();
  expect(a2).not.toBe(b2);
});

test('Export JSON downloads a file containing the task', async ({ page }) => {
  await createTask(page, 0, 2, 'Design');
  await page.getByRole('button', { name: 'Menu' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('roadmap-2026-11-13.json');
  const json = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(json.tasks).toEqual([
    expect.objectContaining({ title: 'Design', start: '2026-11-13', end: '2026-11-15' }),
  ]);
});

test('tasks survive a reload (autosave)', async ({ page }) => {
  await createTask(page, 0, 2, 'Design');
  await expect(page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();
});

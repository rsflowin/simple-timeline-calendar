import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PX_PER_DAY } from '../src/domain/scale.ts';
import { drag, openApp } from './helpers.ts';

const DAY_PX = PX_PER_DAY.day;

test.beforeEach(async ({ page }) => {
  await openApp(page);
  const day = page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Day' });
  await day.click();
  await expect(day).toHaveAttribute('aria-pressed', 'true');
});

/** Viewport point in the first row, at the middle of the day `offset` days from today (centred on load). */
async function dayPoint(page: Page, offset: number): Promise<[number, number]> {
  const box = await page.getByRole('region', { name: 'Timeline' }).evaluate((el) => ({
    x: el.getBoundingClientRect().left + el.clientWidth / 2,
    // scroller > content > sticky header; the grid starts below it
    gridTop: el.firstElementChild!.firstElementChild!.getBoundingClientRect().bottom,
  }));
  return [box.x + offset * DAY_PX, box.gridTop + 12];
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
  await page.getByRole('button', { name: 'Export…' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('dialog', { name: 'Export' })
      .getByRole('button', { name: 'Export', exact: true })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe('roadmap-2026-11-13.json');
  const json = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(json.tasks).toEqual([
    expect.objectContaining({ title: 'Design', start: '2026-11-13', end: '2026-11-15' }),
  ]);
});

test('tasks survive a reload and appear in another browser context', async ({ page, browser }) => {
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/roadmap') && r.request().method() === 'PUT' && r.ok(),
  );
  await createTask(page, 0, 2, 'Design');
  await expect(page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();
  await saved;

  await page.reload();
  await expect(page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();

  // Separate browser context (simulates another browser or machine) loads the same task
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.clock.setFixedTime(new Date('2026-11-13T10:00:00'));
    await otherPage.goto('/');
    await expect(otherPage.getByRole('button', { name: 'Design, Nov 13 – Nov 15' })).toBeVisible();

    // Editing from the first page while the second is stale triggers a conflict warning on the second
    const saved2 = page.waitForResponse(
      (r) => r.url().endsWith('/api/roadmap') && r.request().method() === 'PUT' && r.ok(),
    );
    await createTask(page, 3, 4, 'Build');
    await saved2;

    await otherPage.getByRole('button', { name: '+ New task' }).click();
    const dialog = otherPage.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Stale edit');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(otherPage.getByRole('alert')).toContainText('changed on another device or tab');
  } finally {
    await other.close();
  }
});

test('Import JSON saves a large multi-byte roadmap (> 64 KiB UTF-8) and survives reload', async ({
  page,
}) => {
  const details = '가나다라마바사아자차카타파하'.repeat(200);
  const largeDoc = {
    format: 'timeline-calendar',
    version: 1,
    tags: [{ id: 't1', name: '한국어 태그', color: 'blue' }],
    tasks: Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`,
      title: `작업 ${i + 1}`,
      details,
      start: '2026-11-13',
      end: '2026-11-15',
      tagIds: ['t1'],
      createdAt: '2026-11-13T00:00:00.000Z',
      updatedAt: '2026-11-13T00:00:00.000Z',
    })),
  };
  const json = JSON.stringify(largeDoc, null, 2);
  expect(json.length).toBeLessThan(60_000);
  expect(Buffer.byteLength(json, 'utf8')).toBeGreaterThan(65_536);

  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/roadmap') && r.request().method() === 'PUT' && r.ok(),
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import…' }).click(),
  ]);
  await chooser.setFiles({
    name: 'large-roadmap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf8'),
  });

  await expect(page.getByRole('alert')).toContainText('Imported 10 tasks and 1 tag.');
  await saved;

  await page.reload();
  await expect(page.getByRole('button', { name: '작업 1, Nov 13 – Nov 15' })).toBeVisible();
});

test('Menu Tag display switches between dedicated tag lines and compact packing, and opens Manage tags', async ({
  page,
}) => {
  const seeded = JSON.stringify({
    format: 'timeline-calendar',
    version: 1,
    tags: [
      { id: 't1', name: 'Phase 1', color: 'blue' },
      { id: 't2', name: 'Phase 2', color: 'orange' },
    ],
    tasks: [
      {
        id: 'a1',
        title: 'Alpha 1',
        details: '',
        start: '2026-11-10',
        end: '2026-11-12',
        tagIds: ['t1'],
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
      {
        id: 'b1',
        title: 'Beta 1',
        details: '',
        start: '2026-11-14',
        end: '2026-11-15',
        tagIds: ['t2'],
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
      {
        id: 'a2',
        title: 'Alpha 2',
        details: '',
        start: '2026-11-17',
        end: '2026-11-18',
        tagIds: ['t1'],
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
    ],
  });
  await openApp(page, seeded);
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Day' }).click();

  const y = async (name: string) =>
    (await page.getByRole('button', { name: new RegExp(`^${name},`) }).boundingBox())!.y;

  // Dedicated (default): Alpha 1 & Alpha 2 share one row; Beta 1 stays on its own row
  expect(await y('Alpha 1')).toBe(await y('Alpha 2'));
  expect(await y('Beta 1')).not.toBe(await y('Alpha 1'));

  await expect(page.getByRole('button', { name: 'Preferences' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Tag display/ }).click();
  await page.getByRole('radio', { name: /Tag-first compact packing/ }).click();

  // Compact: non-overlapping tracks share row 0
  expect(await y('Beta 1')).toBe(await y('Alpha 1'));
  expect(await y('Alpha 2')).toBe(await y('Alpha 1'));

  // Manage tags is reachable from Menu
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await page.getByRole('button', { name: 'Manage tags' }).click();
  await expect(page.getByRole('dialog', { name: 'Manage tags' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
});

test('Manage tags drag-and-drop reorders dedicated tag lines on the timeline', async ({ page }) => {
  const seeded = JSON.stringify({
    format: 'timeline-calendar',
    version: 1,
    tags: [
      { id: 't1', name: 'Phase 1', color: 'blue' },
      { id: 't2', name: 'Phase 2', color: 'orange' },
    ],
    tasks: [
      {
        id: 'a1',
        title: 'Alpha 1',
        details: '',
        start: '2026-11-10',
        end: '2026-11-12',
        tagIds: ['t1'],
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
      {
        id: 'b1',
        title: 'Beta 1',
        details: '',
        start: '2026-11-14',
        end: '2026-11-15',
        tagIds: ['t2'],
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      },
    ],
  });
  await openApp(page, seeded);
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Day' }).click();

  const y = async (name: string) =>
    (await page.getByRole('button', { name: new RegExp(`^${name},`) }).boundingBox())!.y;

  expect(await y('Alpha 1')).toBeLessThan(await y('Beta 1'));

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Manage tags' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage tags' });
  const h1 = (await dialog.getByRole('button', { name: 'Reorder Phase 1' }).boundingBox())!;
  const h2 = (await dialog.getByRole('button', { name: 'Reorder Phase 2' }).boundingBox())!;
  await drag(
    page,
    [h1.x + h1.width / 2, h1.y + h1.height / 2],
    [h2.x + h2.width / 2, h2.y + h2.height / 2 + 10],
  );
  await dialog.getByRole('button', { name: 'Done' }).click();

  expect(await y('Beta 1')).toBeLessThan(await y('Alpha 1'));

  await page.keyboard.press('Control+z');
  expect(await y('Alpha 1')).toBeLessThan(await y('Beta 1'));
});

test('Mouse & drag settings control click-create and scroll-panning across reloads', async ({
  page,
}) => {
  await createTask(page, 0, 2, 'Design');
  const bar = page.getByRole('button', { name: 'Design, Nov 13 – Nov 15' });
  const scroller = page.getByRole('region', { name: 'Timeline' });

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Mouse & drag/ }).click();
  await page.getByRole('checkbox', { name: /Click empty space to create/ }).click();
  await page.getByRole('radio', { name: /Move scroll/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Click empty space no longer opens QuickCreate
  const [x0, y0] = await dayPoint(page, 4);
  await page.mouse.click(x0, y0);
  await expect(page.getByRole('dialog', { name: 'New task' })).toHaveCount(0);

  // Dragging empty space pans scrollLeft
  const beforeScroll = await scroller.evaluate((el) => el.scrollLeft);
  await drag(page, [x0, y0], [x0 - 80, y0]);
  const afterScroll = await scroller.evaluate((el) => el.scrollLeft);
  expect(afterScroll).toBeGreaterThan(beforeScroll + 40);

  // Dragging a bar pans instead of moving the task; clicking it opens Edit task
  const box = (await bar.boundingBox())!;
  const barCenter: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];
  await drag(page, barCenter, [barCenter[0] - 60, barCenter[1]]);
  await expect(bar).toHaveAccessibleName('Design, Nov 13 – Nov 15');
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(afterScroll + 20);

  await bar.click();
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Settings persist across reload
  await page.reload();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: /Mouse & drag/ })).toHaveText(/Scroll/);
  await page.getByRole('button', { name: /Mouse & drag/ }).click();
  await expect(
    page.getByRole('checkbox', { name: /Click empty space to create/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('radio', { name: /Move scroll/ })).toBeChecked();
});

test('consecutive saves of a 32–60 KB roadmap succeed without keepalive quota exhaustion', async ({
  page,
}) => {
  const seeded = JSON.stringify(
    {
      format: 'timeline-calendar',
      version: 1,
      tags: [],
      tasks: Array.from({ length: 6 }, (_, i) => ({
        id: `big-${i}`,
        title: `Task ${i + 1}`,
        details: 'x'.repeat(9000),
        start: '2026-11-13',
        end: '2026-11-15',
        tagIds: [],
        createdAt: '2026-11-13T00:00:00.000Z',
        updatedAt: '2026-11-13T00:00:00.000Z',
      })),
    },
    null,
    2,
  );
  const bytes = Buffer.byteLength(seeded, 'utf8');
  expect(bytes).toBeGreaterThan(32_768);
  expect(bytes).toBeLessThan(60_000);

  await openApp(page, seeded);

  for (const title of ['Follow-up 1', 'Follow-up 2', 'Follow-up 3']) {
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/roadmap') && r.request().method() === 'PUT' && r.ok(),
    );
    await page.getByRole('button', { name: '+ New task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await saved;
    await expect(page.getByRole('alert')).toHaveCount(0);
  }

  await page.reload();
  await expect(page.getByRole('button', { name: 'Follow-up 3, Nov 13' })).toBeVisible();
});

test('create and edit task dialogs expand vertically so Details shows ample text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page);

  await page.getByRole('button', { name: '+ New task' }).click();
  const createDialog = page.getByRole('dialog', { name: 'New task' });
  await expect(createDialog).toBeVisible();
  const createDialogBox = (await createDialog.boundingBox())!;
  const createDetailsBox = (await createDialog.getByLabel('Details').boundingBox())!;
  expect(createDialogBox.height).toBeGreaterThanOrEqual(680);
  expect(createDetailsBox.height).toBeGreaterThanOrEqual(280);

  await createDialog.getByLabel('Title').fill('Check details height');
  await createDialog.getByLabel('Details').fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6');
  await createDialog.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Check details height, Nov 13' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(editDialog).toBeVisible();
  const editDialogBox = (await editDialog.boundingBox())!;
  const editDetailsBox = (await editDialog.getByLabel('Details').boundingBox())!;
  const saveBox = (await editDialog.getByRole('button', { name: 'Save' }).boundingBox())!;
  expect(editDialogBox.height).toBeGreaterThanOrEqual(680);
  expect(editDetailsBox.height).toBeGreaterThanOrEqual(280);
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(editDialogBox.y + editDialogBox.height);
});

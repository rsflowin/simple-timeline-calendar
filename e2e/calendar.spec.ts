import { expect, test, type Locator } from '@playwright/test';
import { PX_PER_DAY } from '../src/domain/scale.ts';
import { dayIndex, drag, openApp } from './helpers.ts';

const centre = async (l: Locator): Promise<[number, number]> => {
  const b = (await l.boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2];
};

/** The bar's middle lies inside the day cell. */
async function expectInCell(bar: Locator, cell: Locator) {
  const [x, y] = await centre(bar);
  const c = (await cell.boundingBox())!;
  expect(x).toBeGreaterThan(c.x);
  expect(x).toBeLessThan(c.x + c.width);
  expect(y).toBeGreaterThan(c.y);
  expect(y).toBeLessThan(c.y + c.height);
}

test('Month view: click a day to create a task, then drag it to the next week', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Calendar' }).click();
  await expect(page.getByRole('button', { name: 'Month', pressed: true })).toBeVisible();

  const nov13 = page.locator(`[data-day="${dayIndex('2026-11-13')}"]`);
  const nov20 = page.locator(`[data-day="${dayIndex('2026-11-20')}"]`);
  await nov13.click();
  const input = page.getByRole('dialog', { name: 'New task' }).getByLabel('Task title');
  await input.fill('Launch');
  await input.press('Enter');

  const bar = page.getByRole('button', { name: /^Launch, / });
  await expect(bar).toHaveAccessibleName('Launch, Nov 13');
  await expectInCell(bar, nov13);

  await drag(page, await centre(bar), await centre(nov20));
  await expect(bar).toHaveAccessibleName('Launch, Nov 20');
  await expectInCell(bar, nov20);
});

test('Month view respects Mouse & drag Do nothing and Click-to-create off settings', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Calendar' }).click();

  const nov13 = page.locator(`[data-day="${dayIndex('2026-11-13')}"]`);
  const nov20 = page.locator(`[data-day="${dayIndex('2026-11-20')}"]`);
  await nov13.click();
  const input = page.getByRole('dialog', { name: 'New task' }).getByLabel('Task title');
  await input.fill('Launch');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Mouse & drag/ }).click();
  await page.getByRole('checkbox', { name: /Click empty space to create/ }).click();
  await page.getByRole('radio', { name: /Do nothing/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await nov20.click();
  await expect(page.getByRole('dialog', { name: 'New task' })).toHaveCount(0);

  await drag(page, await centre(nov13), await centre(nov20));
  await expect(page.getByRole('dialog', { name: 'New task' })).toHaveCount(0);

  const bar = page.getByRole('button', { name: 'Launch, Nov 13' });
  await drag(page, await centre(bar), await centre(nov20));
  await expect(bar).toHaveAccessibleName('Launch, Nov 13');

  await bar.click();
  await expect(page.getByRole('complementary', { name: 'Task preview' })).toBeVisible();
  await bar.dblclick();
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
});

test('Daily briefing: view date clicks and Agenda date controls work across Timeline and Calendar', async ({
  page,
}) => {
  const seeded = JSON.stringify({
    format: 'timeline-calendar',
    version: 1,
    tags: [],
    tasks: [
      {
        id: 't1',
        title: 'Mid-month check',
        details: 'Review roadmap',
        start: '2026-11-15',
        end: '2026-11-16',
        tagIds: [],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Next-month kickoff',
        details: '',
        start: '2026-12-03',
        end: '2026-12-03',
        tagIds: [],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  });
  await openApp(page, seeded);

  // Timeline Day zoom: click Nov 15 in the header date bar -> shows blue line + red today line
  const timeline = page.getByRole('region', { name: 'Timeline' });
  const redLine = timeline.locator('[class*="grid"] > [class*="today"]');
  const blueLine = timeline.locator('[class*="grid"] > [class*="agendaLine"]');

  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Day' }).click();
  await page.getByRole('button', { name: 'Agenda for Sun, Nov 15' }).click();
  const agenda = page.getByRole('complementary', { name: 'Agenda' });
  await expect(agenda.getByRole('heading', { name: 'Nov 15' })).toBeVisible();
  await expect(agenda.getByRole('button', { name: 'Mid-month check' })).toBeVisible();
  await expect(blueLine).toBeVisible();
  await expect(redLine).toBeVisible();

  // Clicking the exact selected date again hides blue line & closes Agenda, keeping red line
  await page.getByRole('button', { name: 'Agenda for Sun, Nov 15' }).click();
  await expect(agenda).toHaveCount(0);
  await expect(blueLine).toHaveCount(0);
  await expect(redLine).toBeVisible();

  // Re-open Nov 15, then click top toolbar "Today" button -> hides blue line, keeps red line
  await page.getByRole('button', { name: 'Agenda for Sun, Nov 15' }).click();
  await expect(blueLine).toBeVisible();
  await page
    .getByRole('group', { name: 'Date navigation', exact: true })
    .getByRole('button', { name: 'Today' })
    .click();
  await expect(agenda.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(blueLine).toHaveCount(0);
  await expect(redLine).toBeVisible();

  // Timeline Week zoom: click the header above Nov 15 (+2 days from today), then close Agenda -> hides blue line, keeps red line
  await agenda.getByRole('button', { name: 'Close agenda' }).click();
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Week' }).click();
  const todayBox = (await redLine.boundingBox())!;
  const headerBox = (await timeline.locator('[class*="header"]').first().boundingBox())!;
  await page.mouse.click(
    todayBox.x + todayBox.width / 2 + 2 * PX_PER_DAY.week,
    headerBox.y + headerBox.height / 2,
  );
  await expect(agenda.getByRole('heading', { name: 'Nov 15' })).toBeVisible();
  await expect(agenda.getByRole('button', { name: 'Mid-month check' })).toBeVisible();
  await expect(blueLine).toBeVisible();
  await expect(redLine).toBeVisible();

  await agenda.getByRole('button', { name: 'Close agenda' }).click();
  await expect(blueLine).toHaveCount(0);
  await expect(redLine).toBeVisible();

  // Re-open Nov 15 in Week zoom so in-panel controls run from Nov 15
  await page.mouse.click(
    todayBox.x + todayBox.width / 2 + 2 * PX_PER_DAY.week,
    headerBox.y + headerBox.height / 2,
  );
  await expect(agenda.getByRole('heading', { name: 'Nov 15' })).toBeVisible();

  // In-panel controls: step forward, pick an arbitrary date, reset to Today
  await agenda.getByRole('button', { name: 'Next day' }).click();
  await expect(agenda.getByRole('heading', { name: 'Nov 16' })).toBeVisible();
  await expect(agenda.getByRole('button', { name: 'Mid-month check' })).toBeVisible();

  await agenda.getByLabel('Agenda date', { exact: true }).fill('2026-12-03');
  await expect(agenda.getByRole('heading', { name: 'Dec 3' })).toBeVisible();
  await expect(agenda.getByRole('button', { name: 'Next-month kickoff' })).toBeVisible();

  await agenda.getByRole('button', { name: 'Today' }).click();
  await expect(agenda.getByRole('heading', { name: 'Today' })).toBeVisible();

  // Calendar Month view: clicking date pill opens Agenda without quick-create
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Agenda for Mon, Nov 16' }).click();
  await expect(page.getByRole('dialog', { name: 'New task' })).toHaveCount(0);
  await expect(agenda.getByRole('heading', { name: 'Nov 16' })).toBeVisible();

  // Calendar Week view: clicking weekday header date opens Agenda
  await page.getByRole('group', { name: 'Calendar mode' }).getByRole('button', { name: 'Week' }).click();
  await page.getByRole('button', { name: 'Agenda for Sun, Nov 15' }).click();
  await expect(agenda.getByRole('heading', { name: 'Nov 15' })).toBeVisible();
});

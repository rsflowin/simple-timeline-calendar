import { expect, test, type Locator } from '@playwright/test';
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
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
});

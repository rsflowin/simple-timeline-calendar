import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers.ts';

const COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray'];

/** One task per tag colour (plus an untagged one), so axe checks every bar colour pair. */
const ROADMAP = JSON.stringify({
  format: 'timeline-calendar',
  version: 1,
  tags: COLORS.map((color) => ({ id: `tag-${color}`, name: color, color })),
  tasks: [...COLORS, null].map((color, i) => ({
    id: `task-${i}`,
    title: `Task ${color ?? 'untagged'}`,
    details: '',
    start: `2026-11-${String(2 + i).padStart(2, '0')}`,
    end: `2026-11-${String(4 + i).padStart(2, '0')}`,
    tagIds: color ? [`tag-${color}`] : [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  })),
});

async function expectNoSeriousViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(bad, where).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await openApp(page, ROADMAP);
});

test('axe: no serious or critical violations', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Task blue, Nov 2 – Nov 4' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Timeline');

  await page.getByRole('button', { name: 'Task blue, Nov 2 – Nov 4' }).press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Task dialog');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Menu');
  await page.getByRole('button', { name: /Tag display/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Tag display' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Menu Tag display');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Mouse & drag/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Drag and drop' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Menu Mouse & drag');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Manage tags' }).click();
  await expect(page.getByRole('dialog', { name: 'Manage tags' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Manage tags');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Calendar' }).click();
  await expect(page.getByRole('button', { name: 'Task blue, Nov 2 – Nov 4' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Calendar Month');

  await page.getByRole('button', { name: 'Year' }).click();
  await expect(page.getByRole('button', { name: 'January' })).toBeVisible();
  await expectNoSeriousViolations(page, 'Calendar Year');
});

test('keyboard: Tab reaches a bar, Enter opens it, Delete deletes it', async ({ page }) => {
  const bar = page.getByRole('button', { name: 'Task blue, Nov 2 – Nov 4' });
  await page.getByRole('region', { name: 'Timeline' }).focus();
  for (let i = 0; i < 20 && !(await bar.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(bar).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar).toBeFocused();

  // still selected, but Delete from the toolbar must not delete it
  await page.getByRole('button', { name: 'Pack rows' }).focus();
  await page.keyboard.press('Delete');
  await expect(bar).toHaveCount(1);

  await bar.focus();
  await page.keyboard.press('Delete');
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Timeline' })).toBeFocused();
});

test('keyboard: Year view day opens its task list and quick-create', async ({ page }) => {
  await page.getByRole('button', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Year' }).click();
  await page.getByRole('button', { name: 'Nov 3, 2 tasks' }).focus();
  await page.keyboard.press('Enter');
  const popover = page.getByRole('dialog', { name: 'Tasks on Nov 3' });
  await expect(popover.getByRole('button', { name: 'Task blue' })).toBeVisible();
  await popover.getByRole('button', { name: '+ Add task' }).press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'New task' }).getByLabel('Task title'),
  ).toBeFocused();
});

test('no horizontal page scroll at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const pageWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await pageWidth()).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'Calendar' }).click();
  for (const mode of ['Week', 'Month', 'Year']) {
    await page
      .getByRole('group', { name: 'Calendar mode' })
      .getByRole('button', { name: mode })
      .click();
    expect(await pageWidth(), mode).toBeLessThanOrEqual(375);
  }
});

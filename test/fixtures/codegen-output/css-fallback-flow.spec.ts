// Hand-authored to match Playwright `codegen --target=playwright-test` output.
// Codegen falls back to `page.locator('<css>')` whenever no role/label/text
// selector is unique enough, and appends `.first()` / `.nth(n)` when the
// selector still matches more than one element.
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');
  await page.locator('#sidebar-toggle').click();
  await page.locator('div.card > button.primary').first().click();
  await page.locator('[data-widget="chart"]').nth(2).hover();
  await page.getByAltText('Company logo').click();
  await page.getByTitle('Close panel').click();
  await page.getByText('Dashboard', { exact: true }).click();
  await expect(page.locator('#status-banner')).toHaveText('All systems operational');
});

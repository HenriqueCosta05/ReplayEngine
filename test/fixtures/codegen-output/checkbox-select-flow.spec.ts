// Hand-authored to match Playwright `codegen --target=playwright-test` output.
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/preferences');
  await page.getByRole('checkbox', { name: 'Subscribe to the newsletter' }).check();
  await page.getByLabel('Enable beta features').check();
  await page.getByLabel('Enable beta features').uncheck();
  await page.getByLabel('Country').selectOption('br');
  await page.getByRole('combobox', { name: 'Plan' }).selectOption('pro');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences saved')).toBeVisible();
});

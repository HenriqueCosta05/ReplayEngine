// Hand-authored to match Playwright `codegen --target=playwright-test` output.
// See docs/MANUAL-SMOKE-TESTS.md item 1: this shape must be re-validated
// against a real codegen session by a human before release.
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('ada@example.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
});

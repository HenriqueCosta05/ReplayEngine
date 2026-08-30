// Hand-authored to match Playwright `codegen --target=playwright-test` output.
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/search');
  await page.getByPlaceholder('Search products').click();
  await page.getByPlaceholder('Search products').fill('espresso');
  await page.getByPlaceholder('Search products').press('Enter');
  await expect(page.getByPlaceholder('Search products')).toHaveValue('espresso');
  await expect(page.getByTestId('result-count')).toHaveText('3 results');
  await page.getByRole('link', { name: 'Espresso Machine' }).hover();
  await expect(page.getByTestId('preview-title')).toHaveText('Espresso Machine');
});

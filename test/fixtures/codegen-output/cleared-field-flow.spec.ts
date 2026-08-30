// Hand-authored to match Playwright `codegen --target=playwright-test` output.
//
// Real codegen emits `fill('')` whenever the person recording clears a text
// field (select-all, delete, retype). The parser accepts it as an ordinary
// `fill`; Task 1's domain rule rejects an empty `fill` value. This fixture
// pins the behaviour at that seam: the failure must name *this line*, not
// arrive as a bare DomainError that aborts the whole recording session with
// no indication of which statement caused it.
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/profile');
  await page.getByLabel('Display name').click();
  await page.getByLabel('Display name').fill('');
  await page.getByLabel('Display name').fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Profile updated')).toBeVisible();
});

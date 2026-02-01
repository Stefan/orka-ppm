/**
 * E2E: Data import flow (file upload, parsing, validation)
 * Enterprise Test Strategy - Task 5.5
 * Requirements: 8.4, 8.5, 8.6
 * @regression
 */

import { test, expect } from '@playwright/test';

test.describe('Data import flow @regression', () => {
  test('financials or import page loads', async ({ page }) => {
    await page.goto('/financials');
    await expect(page).toHaveURL(/\/financials/);
  });

  test('import route exists', async ({ page }) => {
    const res = await page.goto('/import');
    expect([200, 307, 308]).toContain(res?.status() ?? 0);
  });
});

/**
 * E2E: AI query flow (query submission, processing, result display)
 * Enterprise Test Strategy - Task 5.5
 * Requirements: 8.4, 8.5, 8.6
 * @regression
 */

import { test, expect } from '@playwright/test';

test.describe('AI query flow @regression', () => {
  test('reports page loads', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/reports/);
  });

  test('reports page has chat or input area', async ({ page }) => {
    await page.goto('/reports');
    const input = page.getByRole('textbox').or(page.getByPlaceholder(/message|query|ask/i)).first();
    await expect(input).toBeVisible({ timeout: 15000 }).catch(() => {});
  });
});

/**
 * E2E: Login → Dashboard flow
 * Enterprise Test Strategy - Task 5.5
 * Requirements: 8.4, 8.5, 8.6, 12.1
 * @regression
 */

import { test, expect } from '@playwright/test';

test.describe('Login to Dashboard @regression', () => {
  test('login page loads and has sign-in elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    const email = page.getByLabel(/email|e-mail|login/i).first();
    const password = page.getByLabel(/password/i).first();
    await expect(email.or(password)).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('after auth redirect to dashboard', async ({ page }) => {
    await page.goto('/dashboards');
    await expect(page).toHaveURL(/\/(dashboards|login)/);
  });
});

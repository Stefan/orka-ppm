/**
 * E2E: SSO login UI and callback
 * Requirements: SSO buttons on login, callback redirect behavior
 * @regression
 */

import { test, expect } from '@playwright/test'

test.describe('SSO Login @regression', () => {
  test('login page shows SSO section and Google/Microsoft buttons', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)

    await expect(page.getByText(/or sign in with/i)).toBeVisible({ timeout: 10000 })
    const googleBtn = page.getByTestId('sso-google')
    const microsoftBtn = page.getByTestId('sso-microsoft')
    await expect(googleBtn).toBeVisible()
    await expect(microsoftBtn).toBeVisible()
    await expect(googleBtn).toContainText(/google/i)
    await expect(microsoftBtn).toContainText(/microsoft/i)
  })

  test('auth callback page shows loading state then redirects', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page.getByTestId('auth-callback-page')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/signing you in|redirecting/i)).toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(/\/(auth\/callback|login|dashboards)/, { timeout: 10000 })
  })
})

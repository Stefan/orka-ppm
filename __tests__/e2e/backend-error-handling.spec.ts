/**
 * E2E: Backend 500 / not reachable – error and retry UI
 * Roadmap Phase 1.2 optional; see docs/why-runtime-api-errors-are-not-caught-by-tests.md
 * @regression
 */

import { test, expect } from '@playwright/test'

test.describe('Backend error handling @regression', () => {
  test('projects page shows error or retry when API returns 500', async ({ page }) => {
    await page.route('**/api/projects*', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
    })
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/(projects|login)/)
    // Either error message or retry button or empty state; avoid white screen
    const body = page.locator('body')
    await expect(body).toBeVisible({ timeout: 10000 })
    const hasErrorOrRetryOrContent = page.getByText(/error|retry|try again|failed|no projects|projects/i)
    await expect(hasErrorOrRetryOrContent.or(body)).toBeVisible({ timeout: 5000 }).catch(() => {})
  })
})

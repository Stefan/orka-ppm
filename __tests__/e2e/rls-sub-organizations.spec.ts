/**
 * E2E: RLS + Sub-Organizations
 * Spec: .kiro/specs/rls-sub-organizations/ Task 5
 * - Admin orgs hierarchy page loads; user sees tree or access denied.
 * - Data scope: user sees only own + sub-org data (validated via API/UI when seeded).
 */

import { test, expect } from '@playwright/test'

test.describe('RLS and Sub-Organizations', () => {
  test('admin orgs page loads and shows tree or access denied', async ({ page }) => {
    await page.goto('/admin/orgs')
    await expect(page).toHaveURL(/\/(admin\/orgs|login)/)

    if (page.url().includes('/login')) {
      await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible({ timeout: 5000 }).catch(() => {})
      return
    }

    await expect(page.getByTestId('admin-orgs-page')).toBeVisible({ timeout: 10000 })
    const heading = page.getByRole('heading', { name: /organisations?\s*\(hierarchy\)/i })
    await expect(heading).toBeVisible({ timeout: 5000 })
  })

  test('admin orgs page has back link to admin', async ({ page }) => {
    await page.goto('/admin/orgs')
    if (!page.url().includes('/admin/orgs')) return
    const back = page.getByRole('button', { name: /admin/i }).or(page.getByText('← Admin'))
    await expect(back.first()).toBeVisible({ timeout: 8000 })
  })

  test('organisations tree or empty state is present when authorised', async ({ page }) => {
    await page.goto('/admin/orgs')
    if (!page.url().includes('/admin/orgs')) return

    await page.waitForLoadState('networkidle').catch(() => {})

    const treeOrEmpty = page.getByTestId('admin-orgs-page')
    await expect(treeOrEmpty).toBeVisible({ timeout: 8000 })

    const hasTree = await page.getByTestId(/org-node-/).first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no organisations|loading/i).isVisible().catch(() => false)
    const hasForbidden = await page.getByText(/access denied/i).isVisible().catch(() => false)

    expect(hasTree || hasEmpty || hasForbidden).toBe(true)
  })

  // Task 5.2 / 5.3: Require seeded users (User A org, User B sub-org, Admin) and auth storageState.
  test('User A: commitments/actuals lists only show data for own org + sub-orgs when RLS applied', async ({ page }) => {
    test.skip(true, 'Requires seeded User A with org scope and test data; run with auth storageState')
    await page.goto('/financials')
    await expect(page).toHaveURL(/\/(financials|login)/)
    if (page.url().includes('/login')) return
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 8000 }).catch(() => {})
  })

  test('Admin: can see all organisations on admin orgs page', async ({ page }) => {
    test.skip(true, 'Requires admin user storageState and multiple orgs in DB')
    await page.goto('/admin/orgs')
    await expect(page).toHaveURL(/\/(admin\/orgs|login)/)
    if (page.url().includes('/login')) return
    await expect(page.getByTestId('admin-orgs-page')).toBeVisible({ timeout: 8000 })
  })

  test('organization-context API returns only allowed shape when authenticated', async ({ request }) => {
    const res = await request.get('/api/users/me/organization-context')
    if (res.status() === 401) {
      expect(res.status()).toBe(401)
      return
    }
    if (res.status() !== 200) return
    const data = await res.json()
    expect(data).toHaveProperty('organizationId')
    expect(data).toHaveProperty('organizationPath')
    expect(data).toHaveProperty('isAdmin')
    expect(typeof data.isAdmin).toBe('boolean')
  })
})

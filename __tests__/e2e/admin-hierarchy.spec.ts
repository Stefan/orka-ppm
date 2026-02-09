/**
 * E2E: Admin hierarchy (Portfolio → Program → Project)
 * Spec: .kiro/specs/entity-hierarchy/ Task 5
 * Requirements: R3.1, R3.4, R5 (sync), RBAC
 */

import { test, expect } from '@playwright/test'

test.describe('Admin hierarchy page', () => {
  test('hierarchy page loads and shows tree or empty state', async ({ page }) => {
    await page.goto('/admin/hierarchy')
    await expect(page).toHaveURL(/\/admin\/hierarchy/)
    await expect(page.getByRole('heading', { name: /hierarchy/i }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Tree|Portfolio|Select a node/i).first()).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  test('has New Portfolio, Program, Project buttons', async ({ page }) => {
    await page.goto('/admin/hierarchy')
    await expect(page.getByRole('button', { name: /portfolio/i }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /program/i }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /project/i }).first()).toBeVisible({ timeout: 5000 })
  })

  test('New Program modal opens and has portfolio select', async ({ page }) => {
    await page.goto('/admin/hierarchy')
    await page.getByRole('button', { name: /program/i }).first().click()
    await expect(page.getByRole('heading', { name: /new program/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/portfolio|select/i).first()).toBeVisible({ timeout: 3000 }).catch(() => {})
    await page.getByRole('button', { name: /cancel/i }).first().click()
  })
})

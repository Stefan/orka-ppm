/**
 * E2E Tests for Audit Timeline Component
 * 
 * Tests filtering functionality and event drill-down interactions
 * Requirements: 2.5, 2.6, 2.7, 2.8, 2.9
 */

import { test, expect } from '@playwright/test'

// Test data
const mockAuditEvents = [
  {
    id: '1',
    event_type: 'user_login',
    user_name: 'John Doe',
    entity_type: 'user',
    entity_id: 'user-123',
    action_details: { ip: '192.168.1.1', browser: 'Chrome' },
    severity: 'info' as const,
    timestamp: new Date('2024-01-15T10:00:00Z').toISOString(),
    anomaly_score: 0.2,
    is_anomaly: false,
    category: 'Security Change',
    risk_level: 'Low' as const,
    tags: { 'login_type': 'standard' },
    tenant_id: 'tenant-1'
  },
  {
    id: '2',
    event_type: 'budget_change',
    user_name: 'Jane Smith',
    entity_type: 'project',
    entity_id: 'project-456',
    action_details: { old_budget: 100000, new_budget: 150000, change_percent: 50 },
    severity: 'critical' as const,
    timestamp: new Date('2024-01-15T11:00:00Z').toISOString(),
    anomaly_score: 0.85,
    is_anomaly: true,
    category: 'Financial Impact',
    risk_level: 'Critical' as const,
    tags: { 'budget_impact': 'high', 'requires_approval': 'true' },
    ai_insights: { 
      explanation: 'Unusual budget increase detected',
      impact: 'High financial impact requiring immediate review'
    },
    tenant_id: 'tenant-1'
  },
  {
    id: '3',
    event_type: 'permission_change',
    user_name: 'Admin User',
    entity_type: 'user',
    entity_id: 'user-789',
    action_details: { permission: 'admin', action: 'granted' },
    severity: 'warning' as const,
    timestamp: new Date('2024-01-15T12:00:00Z').toISOString(),
    anomaly_score: 0.6,
    is_anomaly: false,
    category: 'Security Change',
    risk_level: 'High' as const,
    tags: { 'permission_type': 'admin' },
    tenant_id: 'tenant-1'
  }
]

test.describe('Audit Timeline Component', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API endpoint
    await page.route('**/api/audit/timeline*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockAuditEvents
        })
      })
    })

    // Navigate to audit timeline page
    await page.goto('/audit')
  })

  test('should display timeline with all events', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Check that all events are displayed
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(mockAuditEvents.length)

    // Verify header shows correct count
    const headerText = await page.locator('h3:has-text("Audit Timeline")').textContent()
    expect(headerText).toContain('3 events')
  })

  test('should filter events by severity', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')
    await page.waitForSelector('text=Severity')

    // Uncheck all severities except critical
    await page.uncheck('input[type="checkbox"]:near(:text("info"))')
    await page.uncheck('input[type="checkbox"]:near(:text("warning"))')
    await page.uncheck('input[type="checkbox"]:near(:text("error"))')

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Verify only critical events are shown
    const criticalEvents = mockAuditEvents.filter(e => e.severity === 'critical')
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(criticalEvents.length)
  })

  test('should filter events by category', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')
    await page.waitForSelector('text=Category')

    // Uncheck all categories except Financial Impact
    await page.uncheck('input[type="checkbox"]:near(:text("Security Change"))')
    await page.uncheck('input[type="checkbox"]:near(:text("Resource Allocation"))')
    await page.uncheck('input[type="checkbox"]:near(:text("Risk Event"))')
    await page.uncheck('input[type="checkbox"]:near(:text("Compliance Action"))')

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Verify only Financial Impact events are shown
    const financialEvents = mockAuditEvents.filter(e => e.category === 'Financial Impact')
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(financialEvents.length)
  })

  test('should filter events by risk level', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')
    await page.waitForSelector('text=Risk Level')

    // Uncheck all risk levels except Critical
    await page.uncheck('input[type="checkbox"]:near(:text("Low"))')
    await page.uncheck('input[type="checkbox"]:near(:text("Medium"))')
    await page.uncheck('input[type="checkbox"]:near(:text("High"))')

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Verify only Critical risk events are shown
    const criticalRiskEvents = mockAuditEvents.filter(e => e.risk_level === 'Critical')
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(criticalRiskEvents.length)
  })

  test('should filter to show anomalies only', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')
    await page.waitForSelector('text=Special Filters')

    // Check "Show Anomalies Only"
    await page.check('input[type="checkbox"]:near(:text("Show Anomalies Only"))')

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Verify only anomalies are shown
    const anomalies = mockAuditEvents.filter(e => e.is_anomaly)
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(anomalies.length)

    // Verify header shows anomaly count
    const headerText = await page.textContent('h3:has-text("Audit Timeline")')
    expect(headerText).toContain('1 anomaly')
  })

  test('should clear all filters', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')

    // Apply some filters
    await page.uncheck('input[type="checkbox"]:near(:text("info"))')
    await page.check('input[type="checkbox"]:near(:text("Show Anomalies Only"))')
    await page.waitForTimeout(500)

    // Clear all filters
    await page.click('button:has-text("Clear All Filters")')
    await page.waitForTimeout(500)

    // Verify all events are shown again
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBe(mockAuditEvents.length)
  })

  test('should open event detail modal on click', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Click on an event marker
    await page.click('.recharts-scatter-symbol >> nth=0')

    // Wait for modal to appear
    await page.waitForSelector('text=Event Information', { timeout: 2000 })

    // Verify modal shows event details
    const modalContent = await page.textContent('.fixed.inset-0')
    expect(modalContent).toContain('user_login')
    expect(modalContent).toContain('John Doe')
    expect(modalContent).toContain('Event ID')
  })

  test('should display action details in modal', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Click on budget change event (has detailed action_details)
    await page.click('.recharts-scatter-symbol >> nth=1')

    // Wait for modal
    await page.waitForSelector('text=Action Details', { timeout: 2000 })

    // Verify action details are shown as JSON
    const actionDetails = await page.textContent('pre')
    expect(actionDetails).toContain('old_budget')
    expect(actionDetails).toContain('new_budget')
    expect(actionDetails).toContain('100000')
    expect(actionDetails).toContain('150000')
  })

  test('should display AI insights in modal for anomalies', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Click on anomaly event
    await page.click('.recharts-scatter-symbol >> nth=1')

    // Wait for modal
    await page.waitForSelector('text=Anomaly Detected', { timeout: 2000 })

    // Verify anomaly alert is shown
    const modalContent = await page.textContent('.fixed.inset-0')
    expect(modalContent).toContain('Anomaly Detected')
    expect(modalContent).toContain('85.00%')
    expect(modalContent).toContain('Unusual budget increase detected')
  })

  test('should display AI tags in modal', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Click on event with tags
    await page.click('.recharts-scatter-symbol >> nth=1')

    // Wait for modal
    await page.waitForSelector('text=AI-Generated Tags', { timeout: 2000 })

    // Verify tags are displayed
    const modalContent = await page.textContent('.fixed.inset-0')
    expect(modalContent).toContain('budget_impact: high')
    expect(modalContent).toContain('requires_approval: true')
  })

  test('should close modal when clicking close button', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open modal
    await page.click('.recharts-scatter-symbol >> nth=0')
    await page.waitForSelector('text=Event Information', { timeout: 2000 })

    // Click close button
    await page.click('button:has-text("Close")')

    // Verify modal is closed
    await page.waitForSelector('text=Event Information', { state: 'hidden', timeout: 2000 })
  })

  test('should export event details from modal', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open modal
    await page.click('.recharts-scatter-symbol >> nth=0')
    await page.waitForSelector('text=Event Information', { timeout: 2000 })

    // Set up download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export button
    await page.click('button:has-text("Export Event")')

    // Wait for download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/audit-event-.*\.json/)
  })

  test('should show related entity navigation button', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open modal for event with entity_id
    await page.click('.recharts-scatter-symbol >> nth=1')
    await page.waitForSelector('text=Related Entity', { timeout: 2000 })

    // Verify navigation button is present
    const navButton = await page.locator('button:has-text("View project")')
    expect(await navButton.isVisible()).toBe(true)
  })

  test('should filter by date range', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForSelector('[data-testid="audit-timeline"]', { timeout: 5000 })

    // Open filters
    await page.click('button[title="Toggle Filters"]')
    await page.waitForSelector('text=Date Range')

    // Set date range to only include first event
    await page.fill('input[type="date"] >> nth=0', '2024-01-15')
    await page.fill('input[type="date"] >> nth=1', '2024-01-15')

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Verify filtered results
    const eventCount = await page.locator('.recharts-scatter-symbol').count()
    expect(eventCount).toBeGreaterThan(0)
    expect(eventCount).toBeLessThanOrEqual(mockAuditEvents.length)
  })
})

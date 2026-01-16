/**
 * E2E Tests for Semantic Search Component
 * 
 * Tests query submission and result display
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { test, expect } from '@playwright/test'

// Test data
const mockSearchResponse = {
  query: 'Show me all budget changes last week',
  results: [
    {
      event: {
        id: '1',
        event_type: 'budget_change',
        user_name: 'Jane Smith',
        entity_type: 'project',
        entity_id: 'project-456',
        action_details: { 
          old_budget: 100000, 
          new_budget: 150000, 
          change_percent: 50 
        },
        severity: 'critical' as const,
        timestamp: new Date('2024-01-15T11:00:00Z').toISOString(),
        anomaly_score: 0.85,
        is_anomaly: true,
        category: 'Financial Impact',
        risk_level: 'Critical' as const,
        tags: { 
          'budget_impact': 'high', 
          'requires_approval': 'true' 
        },
        ai_insights: { 
          explanation: 'Unusual budget increase detected',
          impact: 'High financial impact requiring immediate review'
        },
        tenant_id: 'tenant-1'
      },
      similarity_score: 0.95,
      relevance_explanation: 'This event directly matches your query about budget changes, showing a 50% increase in project budget.'
    },
    {
      event: {
        id: '2',
        event_type: 'budget_update',
        user_name: 'John Doe',
        entity_type: 'project',
        entity_id: 'project-789',
        action_details: { 
          old_budget: 50000, 
          new_budget: 55000, 
          change_percent: 10 
        },
        severity: 'warning' as const,
        timestamp: new Date('2024-01-14T09:00:00Z').toISOString(),
        anomaly_score: 0.3,
        is_anomaly: false,
        category: 'Financial Impact',
        risk_level: 'Medium' as const,
        tags: { 
          'budget_impact': 'medium' 
        },
        tenant_id: 'tenant-1'
      },
      similarity_score: 0.87,
      relevance_explanation: 'This event shows a moderate budget increase within the specified time period.'
    }
  ],
  ai_response: 'I found 2 budget changes in the past week. The most significant change was a 50% increase in project-456\'s budget from $100,000 to $150,000, which was flagged as an anomaly. There was also a 10% increase in project-789\'s budget from $50,000 to $55,000. Both changes were made by authorized users and are documented in the audit trail.',
  sources: [
    {
      event_id: '1',
      event_type: 'budget_change',
      timestamp: new Date('2024-01-15T11:00:00Z').toISOString()
    },
    {
      event_id: '2',
      event_type: 'budget_update',
      timestamp: new Date('2024-01-14T09:00:00Z').toISOString()
    }
  ],
  total_results: 2
}

const mockEmptyResponse = {
  query: 'Show me events that do not exist',
  results: [],
  ai_response: 'I could not find any events matching your query. Please try rephrasing your question or using different search terms.',
  sources: [],
  total_results: 0
}

test.describe('Semantic Search Component', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the search API endpoint
    await page.route('**/api/audit/search', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      // Return empty results for specific query
      if (postData.query.includes('do not exist')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockEmptyResponse
          })
        })
      } else {
        // Return mock results for other queries
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockSearchResponse
          })
        })
      }
    })

    // Navigate to audit search page
    await page.goto('/audit')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display semantic search component', async ({ page }) => {
    // Wait for search component to load
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Verify component elements are present
    await expect(page.locator('text=AI-Powered Search')).toBeVisible()
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="search-button"]')).toBeVisible()
  })

  test('should display example queries', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Verify example queries are displayed
    await expect(page.locator('text=Try these example queries:')).toBeVisible()
    
    // Check that at least one example query is present
    const exampleQueries = await page.locator('[data-testid^="example-query-"]').count()
    expect(exampleQueries).toBeGreaterThan(0)
  })

  test('should populate input when clicking example query', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Click on first example query
    await page.click('[data-testid="example-query-0"]')

    // Verify input is populated
    const inputValue = await page.inputValue('[data-testid="search-input"]')
    expect(inputValue.length).toBeGreaterThan(0)
  })

  test('should submit search query', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Enter search query
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')

    // Click search button
    await page.click('[data-testid="search-button"]')

    // Wait for loading state
    await expect(page.locator('text=Searching...')).toBeVisible()

    // Wait for results to load
    await page.waitForSelector('text=AI Analysis', { timeout: 5000 })
  })

  test('should submit search on Enter key', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Enter search query
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')

    // Press Enter
    await page.press('[data-testid="search-input"]', 'Enter')

    // Wait for results
    await page.waitForSelector('text=AI Analysis', { timeout: 5000 })
  })

  test('should display AI-generated response', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=AI Analysis', { timeout: 5000 })

    // Verify AI response is displayed
    const aiResponse = await page.textContent('text=AI Analysis >> .. >> p')
    expect(aiResponse).toContain('I found 2 budget changes')
    expect(aiResponse).toContain('50% increase')
  })

  test('should display source references', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=Sources', { timeout: 5000 })

    // Verify sources are displayed
    await expect(page.locator('text=budget_change')).toBeVisible()
    await expect(page.locator('text=budget_update')).toBeVisible()
  })

  test('should display search results with similarity scores', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=Relevant Events', { timeout: 5000 })

    // Verify results are displayed
    const resultCount = await page.locator('[data-testid^="search-result-"]').count()
    expect(resultCount).toBe(2)

    // Verify similarity scores are shown
    await expect(page.locator('text=95.0%')).toBeVisible()
    await expect(page.locator('text=87.0%')).toBeVisible()
  })

  test('should display relevance explanations', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Verify relevance explanation is shown
    const explanation = await page.textContent('[data-testid="search-result-0"]')
    expect(explanation).toContain('This event directly matches your query')
  })

  test('should display event details in results', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Verify event details are displayed
    const result = await page.textContent('[data-testid="search-result-0"]')
    expect(result).toContain('budget_change')
    expect(result).toContain('Jane Smith')
    expect(result).toContain('critical')
    expect(result).toContain('Financial Impact')
  })

  test('should display anomaly indicator for anomalous events', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Verify anomaly badge is shown
    await expect(page.locator('[data-testid="search-result-0"] >> text=Anomaly')).toBeVisible()
  })

  test('should display event tags in results', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Verify tags are displayed
    const result = await page.textContent('[data-testid="search-result-0"]')
    expect(result).toContain('budget_impact: high')
    expect(result).toContain('requires_approval: true')
  })

  test('should open result detail modal on click', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Click on result
    await page.click('[data-testid="search-result-0"]')

    // Wait for modal
    await page.waitForSelector('text=Why this event is relevant:', { timeout: 2000 })

    // Verify modal content
    const modalContent = await page.textContent('.fixed.inset-0')
    expect(modalContent).toContain('budget_change')
    expect(modalContent).toContain('Relevance: 95.0%')
  })

  test('should display relevance explanation in modal', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results and click
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })
    await page.click('[data-testid="search-result-0"]')

    // Wait for modal
    await page.waitForSelector('text=Why this event is relevant:', { timeout: 2000 })

    // Verify explanation is shown
    const modalContent = await page.textContent('.fixed.inset-0')
    expect(modalContent).toContain('This event directly matches your query')
  })

  test('should close result modal', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search and open modal
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })
    await page.click('[data-testid="search-result-0"]')

    // Wait for modal
    await page.waitForSelector('text=Why this event is relevant:', { timeout: 2000 })

    // Close modal
    await page.click('button:has-text("Close")')

    // Verify modal is closed
    await page.waitForSelector('text=Why this event is relevant:', { state: 'hidden', timeout: 2000 })
  })

  test('should clear search and results', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=Relevant Events', { timeout: 5000 })

    // Click clear button (X icon)
    await page.click('button[aria-label="Clear search"]')

    // Verify input is cleared
    const inputValue = await page.inputValue('[data-testid="search-input"]')
    expect(inputValue).toBe('')

    // Verify results are cleared
    await expect(page.locator('text=Relevant Events')).not.toBeVisible()
  })

  test('should handle empty search results', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search with no results
    await page.fill('[data-testid="search-input"]', 'Show me events that do not exist')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=AI Analysis', { timeout: 5000 })

    // Verify empty state is shown
    await expect(page.locator('text=No matching events found')).toBeVisible()
    
    // Verify AI response explains no results
    const aiResponse = await page.textContent('text=AI Analysis >> .. >> p')
    expect(aiResponse).toContain('could not find any events')
  })

  test('should handle search errors gracefully', async ({ page }) => {
    // Override route to return error
    await page.route('**/api/audit/search', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Internal server error'
        })
      })
    })

    // Navigate to page
    await page.goto('/audit')
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes')
    await page.click('[data-testid="search-button"]')

    // Wait for error message
    await page.waitForSelector('text=Search Error', { timeout: 5000 })

    // Verify error is displayed
    await expect(page.locator('text=Failed to perform search')).toBeVisible()
  })

  test('should disable search button while searching', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Enter query
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes')

    // Click search
    await page.click('[data-testid="search-button"]')

    // Verify button is disabled during search
    const searchButton = page.locator('[data-testid="search-button"]')
    await expect(searchButton).toBeDisabled()
  })

  test('should sort results by similarity score', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('[data-testid="search-result-0"]', { timeout: 5000 })

    // Get similarity scores
    const firstScore = await page.textContent('[data-testid="search-result-0"] >> text=/\\d+\\.\\d+%/')
    const secondScore = await page.textContent('[data-testid="search-result-1"] >> text=/\\d+\\.\\d+%/')

    // Verify first result has higher score
    const firstValue = parseFloat(firstScore?.replace('%', '') || '0')
    const secondValue = parseFloat(secondScore?.replace('%', '') || '0')
    expect(firstValue).toBeGreaterThanOrEqual(secondValue)
  })

  test('should display total results count', async ({ page }) => {
    // Wait for search component
    await page.waitForSelector('[data-testid="semantic-search"]', { timeout: 5000 })

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Show me all budget changes last week')
    await page.click('[data-testid="search-button"]')

    // Wait for results
    await page.waitForSelector('text=Relevant Events', { timeout: 5000 })

    // Verify count is displayed
    await expect(page.locator('text=Relevant Events (2)')).toBeVisible()
  })
})

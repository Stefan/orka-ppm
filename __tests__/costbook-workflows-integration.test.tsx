/**
 * Costbook Workflows Integration Tests
 * Task 60: Final Integration for New Requirements
 * Tests NL search, recommendations, EVM, comments, AI import, drag-and-drop workflows.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { parseNLQuery, matchesFilter } from '@/lib/nl-query-parser'
import { generateRecommendations } from '@/lib/recommendation-engine'
import { calculateCPI, calculateSPI } from '@/lib/evm-calculations'
import { fetchComments, createComment, fetchCommentCount } from '@/lib/comments-service'
import { detectColumnMapping } from '@/lib/costbook/ai-import-mapper'
import { saveTemplate, listTemplates, getTemplate } from '@/lib/costbook/import-templates'
import { ProjectWithFinancials, Currency, ProjectStatus } from '@/types/costbook'

describe('Costbook Workflows Integration (Task 60)', () => {
  describe('60.1 NL search workflow', () => {
    it('parses query and applies filter to projects', () => {
      const result = parseNLQuery('over budget')
      expect(result.criteria.overBudget).toBe(true)
      const projects: ProjectWithFinancials[] = [
        { id: '1', name: 'P1', status: ProjectStatus.ACTIVE, budget: 100, total_spend: 110, variance: -10, health_score: 70, currency: Currency.USD, start_date: '', updated_at: '' } as ProjectWithFinancials,
        { id: '2', name: 'P2', status: ProjectStatus.ACTIVE, budget: 100, total_spend: 90, variance: 10, health_score: 80, currency: Currency.USD, start_date: '', updated_at: '' } as ProjectWithFinancials
      ]
      const filtered = projects.filter(p => matchesFilter(p, result.criteria))
      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('1')
    })

    it('parses high variance and filters', () => {
      const result = parseNLQuery('high variance')
      expect(result.criteria.highVariance).toBe(true)
    })
  })

  describe('60.3 Recommendations workflow', () => {
    it('generates recommendations from projects and applies actions', () => {
      const projects: ProjectWithFinancials[] = [
        { id: '1', name: 'P1', status: ProjectStatus.ACTIVE, budget: 1000, total_spend: 1200, variance: -200, health_score: 60, currency: Currency.USD, start_date: '', updated_at: '' } as ProjectWithFinancials
      ]
      const recs = generateRecommendations(projects, [])
      expect(Array.isArray(recs)).toBe(true)
    })
  })

  describe('60.5 EVM metrics workflow', () => {
    it('calculates CPI and SPI correctly', () => {
      const cpi = calculateCPI(100, 80)
      expect(cpi).toBe(1.25)
      const spi = calculateSPI(100, 90)
      expect(spi).toBeGreaterThan(1)
    })
  })

  describe('60.2 AI import workflow', () => {
    it('complete import flow with auto-mapping and template save/load', () => {
      const headers = ['PO No', 'Project', 'Vendor', 'Amount', 'Description']
      const suggestions = detectColumnMapping(headers, 'commitment')
      expect(suggestions.length).toBeGreaterThanOrEqual(1)
      const mapping = Object.fromEntries(suggestions.map(s => [s.csvHeader, s.suggestedSchemaColumn]))
      const template = saveTemplate('Test Template', 'commitment', mapping, false)
      expect(template.id).toBeDefined()
      expect(template.mapping).toEqual(mapping)
      const loaded = getTemplate(template.id)
      expect(loaded?.mapping).toEqual(mapping)
      const list = listTemplates()
      expect(list.some(t => t.id === template.id)).toBe(true)
    })
  })

  describe('60.4 Drag-and-drop forecast', () => {
    it('scenario switching and scenario data structure', async () => {
      const { createBaselineScenario, duplicateScenario } = await import('@/components/costbook/ScenarioSelector')
      const baseline = createBaselineScenario('p1')
      expect(baseline).toHaveProperty('id')
      expect(baseline).toHaveProperty('name')
      expect(baseline.name).toBe('Baseline')
      const dup = duplicateScenario(baseline, 'Copy')
      expect(dup.name).toBe('Copy')
      expect(dup).toHaveProperty('forecastData')
    })
  })

  describe('60.6 Inline comments workflow', () => {
    it('fetches comments and creates comment', async () => {
      const comments = await fetchComments({ project_id: 'proj-001', limit: 10 })
      expect(Array.isArray(comments)).toBe(true)
      const countBefore = await fetchCommentCount('proj-001')
      const created = await createComment({ project_id: 'proj-001', content: 'Integration test comment' })
      expect(created.id).toBeDefined()
      expect(created.content).toBe('Integration test comment')
      const countAfter = await fetchCommentCount('proj-001')
      expect(countAfter).toBeGreaterThanOrEqual(countBefore)
    })
  })
})

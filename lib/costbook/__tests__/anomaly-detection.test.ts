import {
  detectAnomalies,
  getProjectsWithAnomalies,
  getAnomaliesForProject,
  calculateAnomalySummary,
  getMockAnomalies,
  AnomalyType
} from '../anomaly-detection'
import type { ProjectWithFinancials } from '@/types/costbook'
import { ProjectStatus } from '@/types/costbook'

function mockProject(overrides: Partial<ProjectWithFinancials> = {}): ProjectWithFinancials {
  return {
    id: 'p1',
    name: 'Project 1',
    status: ProjectStatus.ACTIVE,
    budget: 100000,
    currency: 'USD' as any,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    total_commitments: 50000,
    total_actuals: 50000,
    total_spend: 50000,
    variance: 50000,
    spend_percentage: 50,
    health_score: 80,
    ...overrides
  }
}

describe('lib/costbook/anomaly-detection', () => {
  describe('detectAnomalies', () => {
    it('returns empty array when fewer than 3 projects', () => {
      expect(detectAnomalies([mockProject(), mockProject({ id: 'p2' })])).toEqual([])
    })

    it('detects variance outliers when variance exceeds threshold', () => {
      const projects = [
        mockProject({ id: 'a', variance: 1000 }),
        mockProject({ id: 'b', variance: 1200 }),
        mockProject({ id: 'c', variance: 1100 }),
        mockProject({ id: 'outlier', variance: 50000 })
      ]
      const result = detectAnomalies(projects)
      const varianceOutliers = result.filter(a => a.anomalyType === AnomalyType.VARIANCE_OUTLIER)
      expect(varianceOutliers.length).toBeGreaterThan(0)
      expect(varianceOutliers[0].projectId).toBe('outlier')
      expect(varianceOutliers[0].details.zScore).toBeDefined()
    })

    it('detects spend velocity when spend_percentage > 90', () => {
      const projects = [
        mockProject({ id: 'v1', spend_percentage: 95 }),
        mockProject({ id: 'v2', spend_percentage: 50 }),
        mockProject({ id: 'v3', spend_percentage: 60 })
      ]
      const result = detectAnomalies(projects)
      const velocity = result.filter(a => a.anomalyType === AnomalyType.SPEND_VELOCITY)
      expect(velocity.length).toBeGreaterThan(0)
      expect(velocity[0].projectId).toBe('v1')
    })

    it('detects vendor concentration when actuals/commitments ratio > 3', () => {
      const projects = [
        mockProject({ id: 'vc', total_commitments: 10, total_actuals: 50 }),
        mockProject({ id: 'b', total_commitments: 20, total_actuals: 20 }),
        mockProject({ id: 'c', total_commitments: 15, total_actuals: 15 })
      ]
      const result = detectAnomalies(projects)
      const vendor = result.filter(a => a.anomalyType === AnomalyType.VENDOR_CONCENTRATION)
      expect(vendor.length).toBeGreaterThan(0)
    })

    it('sorts results by severity and confidence', () => {
      const projects = [
        mockProject({ id: '1', variance: 1000 }),
        mockProject({ id: '2', variance: 1100 }),
        mockProject({ id: '3', variance: 1200 }),
        mockProject({ id: '4', variance: 100000 })
      ]
      const result = detectAnomalies(projects)
      expect(result.length).toBeGreaterThan(0)
      const severities = result.map(r => r.severity)
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      for (let i = 1; i < result.length; i++) {
        expect(order[severities[i] as keyof typeof order]).toBeGreaterThanOrEqual(
          order[severities[i - 1] as keyof typeof order]
        )
      }
    })
  })

  describe('getProjectsWithAnomalies', () => {
    it('filters projects that have anomalies', () => {
      const projects = [
        mockProject({ id: 'proj-001' }),
        mockProject({ id: 'proj-003' }),
        mockProject({ id: 'other' })
      ]
      const anomalies = getMockAnomalies()
      const filtered = getProjectsWithAnomalies(projects, anomalies)
      expect(filtered.map(p => p.id)).toContain('proj-003')
      expect(filtered.map(p => p.id)).toContain('proj-001')
      expect(filtered).toHaveLength(2)
    })
  })

  describe('getAnomaliesForProject', () => {
    it('returns only anomalies for given project', () => {
      const anomalies = getMockAnomalies()
      expect(getAnomaliesForProject('proj-003', anomalies)).toHaveLength(1)
      expect(getAnomaliesForProject('proj-003', anomalies)[0].anomalyType).toBe(AnomalyType.VARIANCE_OUTLIER)
      expect(getAnomaliesForProject('unknown', anomalies)).toHaveLength(0)
    })
  })

  describe('calculateAnomalySummary', () => {
    it('returns counts by severity and type', () => {
      const anomalies = getMockAnomalies()
      const summary = calculateAnomalySummary(anomalies)
      expect(summary.total).toBe(2)
      expect(summary.bySeverity.high).toBe(1)
      expect(summary.bySeverity.medium).toBe(1)
      expect(summary.byType[AnomalyType.VARIANCE_OUTLIER]).toBe(1)
      expect(summary.affectedProjects).toBe(2)
      expect(summary.averageConfidence).toBeGreaterThan(0)
    })

    it('returns zero averages for empty array', () => {
      const summary = calculateAnomalySummary([])
      expect(summary.total).toBe(0)
      expect(summary.averageConfidence).toBe(0)
      expect(summary.affectedProjects).toBe(0)
    })
  })

  describe('getMockAnomalies', () => {
    it('returns predefined mock anomalies', () => {
      const mocks = getMockAnomalies()
      expect(mocks).toHaveLength(2)
      expect(mocks[0].projectId).toBe('proj-003')
      expect(mocks[1].projectId).toBe('proj-001')
    })
  })
})

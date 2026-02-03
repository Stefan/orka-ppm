/**
 * API contract tests: Projects list/GET
 * Enterprise Test Strategy - Section 3 (Phase 2)
 * Validates consumer expectations for Projects API response shape.
 */

import { validateProjectsResponse, validateProjectItem } from './schemas'

const validProject = {
  id: '1',
  name: 'Office Complex Phase 1',
  status: 'active',
  budget: 150000,
  created_at: '2024-01-15T10:00:00Z',
}

describe('Contract: Projects API', () => {
  describe('validateProjectItem', () => {
    it('accepts valid project item', () => {
      expect(validateProjectItem(validProject).valid).toBe(true)
    })

    it('accepts project with numeric id', () => {
      expect(validateProjectItem({ ...validProject, id: 1 }).valid).toBe(true)
    })

    it('rejects missing name', () => {
      const res = validateProjectItem({ id: '1', status: 'active' })
      expect(res.valid).toBe(false)
      if (!res.valid) expect(res.errors.some((e) => e.includes('name'))).toBe(true)
    })

    it('rejects invalid budget type', () => {
      const res = validateProjectItem({ ...validProject, budget: '100' })
      expect(res.valid).toBe(false)
    })
  })

  describe('validateProjectsResponse', () => {
    it('accepts array of projects', () => {
      const res = validateProjectsResponse([validProject, { ...validProject, id: '2', name: 'Project B' }])
      expect(res.valid).toBe(true)
    })

    it('accepts { projects: array } shape', () => {
      const res = validateProjectsResponse({ projects: [validProject] })
      expect(res.valid).toBe(true)
    })

    it('accepts { data: array } shape', () => {
      const res = validateProjectsResponse({ data: [validProject] })
      expect(res.valid).toBe(true)
    })

    it('rejects empty object', () => {
      const res = validateProjectsResponse({})
      expect(res.valid).toBe(false)
    })

    it('rejects invalid item in array', () => {
      const res = validateProjectsResponse([validProject, { id: '2', name: 123, status: 'active' }])
      expect(res.valid).toBe(false)
    })
  })
})

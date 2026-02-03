/**
 * Data-Migration: API response compatibility with minimal/older shapes
 * Enterprise Test Strategy - Section 6 (Phase 2)
 * Ensures frontend can parse minimal or legacy project list responses without crashing.
 */

import { validateProjectsResponse, validateProjectItem } from '@/__tests__/contract/schemas'

describe('Migration: API response compatibility', () => {
  it('accepts minimal project item without created_at or budget', () => {
    const minimal = { id: '1', name: 'Project', status: 'active' }
    const result = validateProjectItem(minimal)
    expect(result.valid).toBe(true)
  })

  it('accepts project with numeric id', () => {
    const result = validateProjectItem({
      id: 42,
      name: 'Project',
      status: 'completed',
    })
    expect(result.valid).toBe(true)
  })

  it('accepts plain array of minimal projects', () => {
    const payload = [
      { id: '1', name: 'A', status: 'active' },
      { id: '2', name: 'B', status: 'planning' },
    ]
    const result = validateProjectsResponse(payload)
    expect(result.valid).toBe(true)
  })

  it('accepts { projects: array } with minimal items', () => {
    const payload = {
      projects: [
        { id: '1', name: 'P1', status: 'active' },
      ],
    }
    const result = validateProjectsResponse(payload)
    expect(result.valid).toBe(true)
  })

  it('accepts { data: array } shape', () => {
    const payload = {
      data: [
        { id: '1', name: 'P1', status: 'active', budget: 1000, created_at: '2024-01-01T00:00:00Z' },
      ],
    }
    const result = validateProjectsResponse(payload)
    expect(result.valid).toBe(true)
  })

  it('parsing does not throw when consuming validated response as array', () => {
    const payload = [{ id: '1', name: 'X', status: 'active' }]
    const result = validateProjectsResponse(payload)
    expect(result.valid).toBe(true)
    const list = Array.isArray(payload) ? payload : (payload as { projects?: unknown[] }).projects ?? (payload as { data?: unknown[] }).data
    expect(Array.isArray(list)).toBe(true)
    expect(list!.length).toBe(1)
    expect((list![0] as { name: string }).name).toBe('X')
  })
})

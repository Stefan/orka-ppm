/**
 * Property 10.3 / 11: AI Change Highlights – detectChanges
 * Validates: Requirements 5.3, 5.4
 */

import { detectChanges } from '@/lib/register-nested-grids/change-detection'

describe('detectChanges', () => {
  it('detects added rows', () => {
    const previous = [{ id: '1', name: 'A' }]
    const current = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    const highlights = detectChanges(previous, current)
    const added = highlights.filter((h) => h.changeType === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].rowId).toBe('2')
    expect(added[0].currentValue).toEqual({ id: '2', name: 'B' })
  })

  it('detects deleted rows', () => {
    const previous = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    const current = [{ id: '1', name: 'A' }]
    const highlights = detectChanges(previous, current)
    const deleted = highlights.filter((h) => h.changeType === 'deleted')
    expect(deleted).toHaveLength(1)
    expect(deleted[0].rowId).toBe('2')
  })

  it('detects modified fields', () => {
    const previous = [{ id: '1', name: 'Old', status: 'open' }]
    const current = [{ id: '1', name: 'New', status: 'open' }]
    const highlights = detectChanges(previous, current)
    const modified = highlights.filter((h) => h.changeType === 'modified')
    expect(modified).toHaveLength(1)
    expect(modified[0].field).toBe('name')
    expect(modified[0].previousValue).toBe('Old')
    expect(modified[0].currentValue).toBe('New')
  })

  it('returns empty when previous and current are equal', () => {
    const data = [{ id: '1', name: 'A' }]
    const highlights = detectChanges(data, data)
    expect(highlights).toHaveLength(0)
  })

  it('uses custom id field when provided', () => {
    const previous = [{ uuid: 'a', title: 'First' }]
    const current = [{ uuid: 'a', title: 'First' }, { uuid: 'b', title: 'Second' }]
    const highlights = detectChanges(previous, current, 'uuid')
    const added = highlights.filter((h) => h.changeType === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].rowId).toBe('b')
  })
})

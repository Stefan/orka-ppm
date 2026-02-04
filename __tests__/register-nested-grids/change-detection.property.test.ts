/**
 * Feature: register-nested-grids, Property 11: AI Change Highlights
 */

import { detectChanges } from '@/lib/register-nested-grids/change-detection'

describe('detectChanges', () => {
  it('detects added items', () => {
    const prev = [{ id: '1', name: 'A' }]
    const curr = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    const changes = detectChanges(prev, curr)
    expect(changes.some((c) => c.changeType === 'added' && c.rowId === '2')).toBe(true)
  })

  it('detects modified items', () => {
    const prev = [{ id: '1', name: 'A' }]
    const curr = [{ id: '1', name: 'B' }]
    const changes = detectChanges(prev, curr)
    expect(changes.some((c) => c.changeType === 'modified' && c.field === 'name')).toBe(true)
  })

  it('detects deleted items', () => {
    const prev = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
    const curr = [{ id: '1', name: 'A' }]
    const changes = detectChanges(prev, curr)
    expect(changes.some((c) => c.changeType === 'deleted' && c.rowId === '2')).toBe(true)
  })
})

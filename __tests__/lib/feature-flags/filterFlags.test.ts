/**
 * Feature Toggle System: filterFlagsBySearch property tests
 * Design: .kiro/specs/feature-toggle-system/design.md
 * Property 16: Case-Insensitive Search Filtering
 * Validates: Requirements 11.1, 11.2
 */

import { filterFlagsBySearch } from '@/lib/feature-flags/filterFlags'

describe('Feature: feature-toggle-system', () => {
  describe('Property 16: Case-Insensitive Search Filtering', () => {
    const flags = [
      { name: 'costbook_phase1', id: '1' },
      { name: 'Costbook_Phase2', id: '2' },
      { name: 'AI_ANOMALY_DETECTION', id: '3' },
      { name: 'nested_grids', id: '4' },
    ]

    it('empty or whitespace query returns all flags', () => {
      expect(filterFlagsBySearch(flags, '')).toEqual(flags)
      expect(filterFlagsBySearch(flags, '   ')).toEqual(flags)
      expect(filterFlagsBySearch(flags, '\t')).toEqual(flags)
    })

    it('filters by substring match case-insensitively', () => {
      expect(filterFlagsBySearch(flags, 'costbook')).toHaveLength(2)
      expect(filterFlagsBySearch(flags, 'COSTBOOK')).toHaveLength(2)
      expect(filterFlagsBySearch(flags, 'CostBook')).toHaveLength(2)
      expect(filterFlagsBySearch(flags, 'phase1')).toHaveLength(1)
      expect(filterFlagsBySearch(flags, 'PHASE1')).toHaveLength(1)
      expect(filterFlagsBySearch(flags, 'ai')).toHaveLength(1)
      expect(filterFlagsBySearch(flags, 'nested')).toHaveLength(1)
    })

    it('trimmed query is used (leading/trailing space ignored for match)', () => {
      expect(filterFlagsBySearch(flags, '  costbook  ')).toHaveLength(2)
      expect(filterFlagsBySearch(flags, ' phase1 ')).toHaveLength(1)
    })

    it('no match returns empty array', () => {
      expect(filterFlagsBySearch(flags, 'xyznone')).toEqual([])
      expect(filterFlagsBySearch(flags, 'zzz')).toEqual([])
    })

    it('preserves original items and order', () => {
      const result = filterFlagsBySearch(flags, 'costbook')
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(flags[0])
      expect(result[1]).toBe(flags[1])
    })

    it('works with empty flags array', () => {
      expect(filterFlagsBySearch([], '')).toEqual([])
      expect(filterFlagsBySearch([], 'any')).toEqual([])
    })
  })
})

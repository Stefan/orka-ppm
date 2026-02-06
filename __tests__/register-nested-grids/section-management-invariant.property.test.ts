/**
 * Property 2: Section Management Invariant
 * Validates: Requirements 2.1, 2.2
 */

import * as fc from 'fast-check'
import { validateNestedGridConfig } from '@/components/register-nested-grids/validation'

const validItemTypes = ['tasks', 'registers', 'cost_registers'] as const

const columnArb = fc.record({
  field: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  headerName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
})

const sectionArb = fc.record({
  itemType: fc.constantFrom(...validItemTypes),
  columns: fc.array(columnArb, { minLength: 1, maxLength: 20 }),
})

const validConfigArb = fc.record({
  sections: fc.array(sectionArb, { minLength: 0, maxLength: 10 }),
  enableLinkedItems: fc.boolean(),
})

describe('Register Nested Grids - Property 5.4: Section Management Invariant', () => {
  describe('validateNestedGridConfig', () => {
    it('accepts valid configs (valid itemType, at least one column per section)', () => {
      fc.assert(
        fc.property(validConfigArb, (config) => {
          const result = validateNestedGridConfig(config)
          expect(result.valid).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('rejects config when section has no columns', () => {
      const config = {
        sections: [
          {
            itemType: 'tasks',
            columns: [],
          },
        ],
        enableLinkedItems: true,
      }
      const result = validateNestedGridConfig(config)
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/at least one column|Section 1/)
    })

    it('rejects config when section has invalid itemType', () => {
      const config = {
        sections: [
          {
            itemType: 'invalid_type',
            columns: [{ field: 'a', headerName: 'A' }],
          },
        ],
        enableLinkedItems: true,
      }
      const result = validateNestedGridConfig(config)
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/invalid itemType|Section 1/)
    })

    it('rejects config when column has empty field', () => {
      const config = {
        sections: [
          {
            itemType: 'tasks',
            columns: [{ field: '  ', headerName: 'A' }],
          },
        ],
        enableLinkedItems: true,
      }
      const result = validateNestedGridConfig(config)
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/field is required|Section 1/)
    })

    it('rejects config when column has empty headerName', () => {
      const config = {
        sections: [
          {
            itemType: 'tasks',
            columns: [{ field: 'f', headerName: '' }],
          },
        ],
        enableLinkedItems: true,
      }
      const result = validateNestedGridConfig(config)
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/headerName is required|Section 1/)
    })

    it('rejects when sections is not an array', () => {
      const result = validateNestedGridConfig({
        sections: null as unknown as [],
        enableLinkedItems: true,
      })
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/sections array/)
    })
  })
})

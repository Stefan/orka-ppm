/**
 * Filter application logic - AND combination
 * Requirements: 9.2, 9.3
 */

import type { Filter } from './types'

export function applyFilters<T extends Record<string, unknown>>(
  data: T[],
  filters: Filter[]
): T[] {
  if (!filters.length) return data

  return data.filter((item) =>
    filters.every((filter) => {
      const value = item[filter.field]

      switch (filter.operator) {
        case 'equals':
          return value === filter.value
        case 'notEquals':
          return value !== filter.value
        case 'contains':
          return String(value ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase())
        case 'notContains':
          return !String(value ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase())
        case 'greaterThan':
          return Number(value) > Number(filter.value)
        case 'lessThan':
          return Number(value) < Number(filter.value)
        case 'between':
          const [a, b] = Array.isArray(filter.value) ? filter.value : [filter.value, filter.value]
          return Number(value) >= Number(a) && Number(value) <= Number(b)
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value)
        case 'notIn':
          return Array.isArray(filter.value) && !filter.value.includes(value)
        default:
          return true
      }
    })
  )
}

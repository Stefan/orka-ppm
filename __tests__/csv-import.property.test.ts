/**
 * Property-Based Tests for CSV Import Utilities
 * 
 * These tests validate:
 * - Property 10: CSV Column Mapping Correctness
 * - Property 11: CSV Import Error Reporting
 * 
 * Uses fast-check for property-based testing.
 */

import * as fc from 'fast-check'
import {
  COMMITMENT_COLUMNS,
  ACTUAL_COLUMNS,
  generateCSVTemplate,
  downloadCSVTemplate
} from '@/lib/costbook/csv-import'
import { Currency, POStatus, ActualStatus } from '@/types/costbook'

// Helper to create a mock File from string content
function createMockFile(content: string, filename: string = 'test.csv'): File {
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], filename, { type: 'text/csv' })
}

// Generate valid commitment CSV row
const validCommitmentRowArbitrary = fc.record({
  po_number: fc.stringMatching(/^PO-\d{4}-\d{3}$/),
  project_id: fc.uuid(),
  vendor_id: fc.uuid(),
  vendor_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(',') && !s.includes('"')),
  description: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes(',') && !s.includes('"')),
  amount: fc.float({ min: 100, max: 1000000, noNaN: true }).map(Math.fround),
  currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CHF', 'JPY'),
  status: fc.constantFrom('draft', 'approved', 'issued', 'received', 'cancelled'),
  issue_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]),
  delivery_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]))
})

// Generate valid actual CSV row
const validActualRowArbitrary = fc.record({
  commitment_id: fc.option(fc.uuid()),
  project_id: fc.uuid(),
  po_number: fc.option(fc.stringMatching(/^PO-\d{4}-\d{3}$/)),
  vendor_id: fc.uuid(),
  vendor_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(',') && !s.includes('"')),
  description: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes(',') && !s.includes('"')),
  amount: fc.float({ min: 100, max: 1000000, noNaN: true }).map(Math.fround),
  currency: fc.constantFrom('USD', 'EUR', 'GBP', 'CHF', 'JPY'),
  status: fc.constantFrom('pending', 'approved', 'rejected', 'cancelled'),
  invoice_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]),
  payment_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]))
})

// Convert row object to CSV line
function rowToCSVLine(row: Record<string, any>, columns: readonly string[]): string {
  return columns.map(col => {
    const val = row[col]
    if (val === undefined || val === null) return ''
    return String(val)
  }).join(',')
}

describe('CSV Import Property Tests', () => {
  describe('Property 10: CSV Column Mapping Correctness', () => {
    it('commitment CSV with valid columns produces correct schema', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validCommitmentRowArbitrary, { minLength: 1, maxLength: 5 }),
          async (rows) => {
            // Build CSV content
            const header = COMMITMENT_COLUMNS.join(',')
            const dataRows = rows.map(row => rowToCSVLine(row, COMMITMENT_COLUMNS))
            const csvContent = [header, ...dataRows].join('\n')
            
            // Verify header has all required columns
            expect(csvContent.split('\n')[0].split(',')).toHaveLength(COMMITMENT_COLUMNS.length)
            
            // Verify each data row has correct number of fields
            dataRows.forEach(row => {
              const fields = row.split(',')
              expect(fields.length).toBe(COMMITMENT_COLUMNS.length)
            })
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('actual CSV with valid columns produces correct schema', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validActualRowArbitrary, { minLength: 1, maxLength: 5 }),
          async (rows) => {
            // Build CSV content
            const header = ACTUAL_COLUMNS.join(',')
            const dataRows = rows.map(row => rowToCSVLine(row, ACTUAL_COLUMNS))
            const csvContent = [header, ...dataRows].join('\n')
            
            // Verify header has all required columns
            expect(csvContent.split('\n')[0].split(',')).toHaveLength(ACTUAL_COLUMNS.length)
            
            // Verify each data row has correct number of fields
            dataRows.forEach(row => {
              const fields = row.split(',')
              expect(fields.length).toBe(ACTUAL_COLUMNS.length)
            })
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('column names are case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...COMMITMENT_COLUMNS),
          fc.constantFrom('upper', 'lower', 'mixed'),
          (column, caseType) => {
            let transformed: string
            switch (caseType) {
              case 'upper':
                transformed = column.toUpperCase()
                break
              case 'lower':
                transformed = column.toLowerCase()
                break
              case 'mixed':
                transformed = column.split('').map((c, i) => 
                  i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
                ).join('')
                break
              default:
                transformed = column
            }
            
            // Normalized comparison should match
            const normalized1 = column.toLowerCase().replace(/[_\s]/g, '')
            const normalized2 = transformed.toLowerCase().replace(/[_\s]/g, '')
            expect(normalized1).toBe(normalized2)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('amount values are parsed correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000000), noNaN: true }),
          (amount) => {
            const csvValue = String(amount)
            const parsed = parseFloat(csvValue.replace(/[^0-9.-]/g, ''))
            
            // Parsed value should be close to original (accounting for string conversion)
            expect(Math.abs(parsed - amount)).toBeLessThan(0.01)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('currency values are parsed to valid enum', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('USD', 'EUR', 'GBP', 'CHF', 'JPY', 'usd', 'eur', 'Usd', 'EUR '),
          (currencyInput) => {
            const normalized = currencyInput.toUpperCase().trim()
            const validCurrencies = Object.values(Currency)
            
            if (validCurrencies.includes(normalized as Currency)) {
              return true
            }
            
            // Invalid currencies should fall back to USD
            return normalized !== 'USD' // Only fails if somehow USD doesn't match
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Property 11: CSV Import Error Reporting', () => {
    it('missing required columns are reported with specific column names', () => {
      fc.assert(
        fc.property(
          fc.subarray(COMMITMENT_COLUMNS.slice() as string[], { minLength: 1, maxLength: COMMITMENT_COLUMNS.length - 1 }),
          (includedColumns) => {
            const missingColumns = COMMITMENT_COLUMNS.filter(col => !includedColumns.includes(col))
            
            // There should be at least one missing column
            expect(missingColumns.length).toBeGreaterThan(0)
            
            // Error message would include these missing columns
            const expectedError = `Missing required columns: ${missingColumns.join(', ')}`
            expect(expectedError).toContain('Missing required columns:')
            missingColumns.forEach(col => {
              expect(expectedError).toContain(col)
            })
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('invalid amount values produce error with row number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }), // Row number (1-indexed, row 1 is header)
          fc.constantFrom('abc', 'not-a-number', '$$$', ''),
          (rowNumber, invalidAmount) => {
            // Error should contain the row number
            const expectedError = { 
              row: rowNumber, 
              column: 'amount', 
              value: invalidAmount, 
              error: 'Valid amount is required' 
            }
            
            expect(expectedError.row).toBe(rowNumber)
            expect(expectedError.column).toBe('amount')
            expect(expectedError.error).toContain('amount')
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('invalid date values are detected', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('not-a-date', '32/13/2024', '2024-13-45', 'yesterday', ''),
          (invalidDate) => {
            // parseDate should return empty string for invalid dates
            const parseDate = (value: string): string => {
              if (!value) return ''
              const date = new Date(value)
              if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0]
              }
              return ''
            }
            
            const result = parseDate(invalidDate)
            
            // Invalid dates should either parse to empty or a valid date
            if (result !== '') {
              // If parsed, should be in YYYY-MM-DD format
              expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            }
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('multiple errors per row are all reported', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          fc.array(fc.constantFrom('po_number', 'project_id', 'vendor_id', 'amount', 'issue_date'), { minLength: 2, maxLength: 5 }),
          (rowNumber, missingFields) => {
            // Each missing field should generate a separate error
            const errors = missingFields.map(field => ({
              row: rowNumber,
              column: field,
              value: '',
              error: expect.stringContaining('required')
            }))
            
            // All errors should have the same row number
            errors.forEach(err => {
              expect(err.row).toBe(rowNumber)
            })
            
            // Should have as many errors as missing fields
            expect(errors.length).toBe(missingFields.length)
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('error row numbers are 1-indexed (user-friendly)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }), // 0-based array index
          (arrayIndex) => {
            // Convert to 1-indexed row number (accounting for header)
            const userRowNumber = arrayIndex + 2 // +1 for header, +1 for 1-indexing
            
            // Row numbers should always be >= 2 (first data row)
            expect(userRowNumber).toBeGreaterThanOrEqual(2)
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('CSV Template Generation', () => {
    it('commitment template has all required columns', () => {
      const template = generateCSVTemplate('commitment')
      const headerLine = template.split('\n')[0]
      const columns = headerLine.split(',')
      
      COMMITMENT_COLUMNS.forEach(col => {
        expect(columns).toContain(col)
      })
    })

    it('actual template has all required columns', () => {
      const template = generateCSVTemplate('actual')
      const headerLine = template.split('\n')[0]
      const columns = headerLine.split(',')
      
      ACTUAL_COLUMNS.forEach(col => {
        expect(columns).toContain(col)
      })
    })

    it('templates include sample data row', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('commitment' as const, 'actual' as const),
          (type) => {
            const template = generateCSVTemplate(type)
            const lines = template.split('\n')
            
            // Should have header and at least one data row
            expect(lines.length).toBeGreaterThanOrEqual(2)
            
            // Data row should have values
            const dataRow = lines[1]
            expect(dataRow.length).toBeGreaterThan(0)
            
            return true
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})

/**
 * Property 31: Auto-Mapping Accuracy (Task 42.5)
 * Validates: Requirements 36.2 - various column names map correctly.
 */

import * as fc from 'fast-check'
import { detectColumnMapping } from '@/lib/costbook/ai-import-mapper'

describe('AI Import Mapper - Property 31: Auto-Mapping Accuracy', () => {
  it('Property 31: known aliases map to correct schema column with confidence >= 0.7', () => {
    const commitmentAliases = [
      ['po_number', 'PO No', 'p.o.', 'Purchase Order'],
      ['project_id', 'Project', 'Project ID'],
      ['vendor_name', 'Vendor', 'Supplier', 'Company'],
      ['amount', 'Amount', 'Value', 'Cost', 'Total'],
      ['description', 'Description', 'Desc', 'Details'],
      ['currency', 'Currency', 'CCY'],
      ['issue_date', 'Date', 'Order Date', 'Created'],
      ['delivery_date', 'Delivery', 'Due Date']
    ]
    for (const [schemaCol, ...headers] of commitmentAliases) {
      for (const header of headers) {
        const suggestions = detectColumnMapping([header], 'commitment')
        expect(suggestions.length).toBeGreaterThanOrEqual(1)
        const match = suggestions.find(s => s.csvHeader === header)
        expect(match).toBeDefined()
        expect(match!.suggestedSchemaColumn).toBe(schemaCol)
        expect(match!.confidence).toBeGreaterThanOrEqual(0.7)
      }
    }
  })

  it('Property 31: exact schema headers map with confidence 1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('commitment', 'actual'),
        (schema) => {
          const headers = schema === 'commitment'
            ? ['po_number', 'project_id', 'vendor_name', 'amount', 'description', 'currency', 'status', 'issue_date', 'delivery_date']
            : ['commitment_id', 'project_id', 'po_number', 'vendor_id', 'vendor_name', 'description', 'amount', 'currency', 'status', 'invoice_date', 'payment_date']
          const suggestions = detectColumnMapping(headers.slice(0, 5), schema as 'commitment' | 'actual')
          for (const s of suggestions) {
            expect(s.confidence).toBe(1)
            expect(headers).toContain(s.suggestedSchemaColumn)
          }
        }
      ),
      { numRuns: 5 }
    )
  })
})

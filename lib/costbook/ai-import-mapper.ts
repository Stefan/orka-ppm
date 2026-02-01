// AI-Powered Import Mapper (Task 42)
// Auto-detection of column types for CSV import; ML optional.

import { COMMITMENT_COLUMNS, ACTUAL_COLUMNS } from './csv-import'

export interface ColumnSuggestion {
  csvHeader: string
  suggestedSchemaColumn: string
  confidence: number
}

const KNOWN_ALIASES: Record<string, string[]> = {
  po_number: ['po', 'po no', 'p.o.', 'purchase order'],
  project_id: ['project', 'project id', 'proj id'],
  vendor_name: ['vendor', 'supplier', 'company'],
  amount: ['value', 'sum', 'total', 'cost'],
  description: ['desc', 'item', 'details'],
  currency: ['curr', 'ccy'],
  status: ['state'],
  issue_date: ['date', 'order date', 'created'],
  delivery_date: ['delivery', 'due date'],
  invoice_date: ['invoice', 'inv date'],
  payment_date: ['payment', 'pay date']
}

/**
 * Auto-detect column mapping from CSV headers to schema columns.
 * Returns suggested mapping with confidence scores (0-1).
 */
export function detectColumnMapping(
  csvHeaders: string[],
  schema: 'commitment' | 'actual'
): ColumnSuggestion[] {
  const schemaColumns = schema === 'commitment' ? [...COMMITMENT_COLUMNS] : [...ACTUAL_COLUMNS]
  const suggestions: ColumnSuggestion[] = []
  const normalized = (s: string) => s.toLowerCase().trim().replace(/[_\s-]/g, '')

  for (const header of csvHeaders) {
    const normHeader = normalized(header)
    let bestMatch = ''
    let bestConfidence = 0

    for (const col of schemaColumns) {
      const normCol = normalized(col)
      if (normHeader === normCol) {
        bestMatch = col
        bestConfidence = 1
        break
      }
      const aliases = KNOWN_ALIASES[col]
      const exactAlias = aliases?.some(a => normalized(a) === normHeader)
      const partialAlias = aliases?.some(a => normHeader.includes(normalized(a)) && normalized(a) !== normHeader)
      if (exactAlias && 0.95 > bestConfidence) {
        bestMatch = col
        bestConfidence = 0.95
      } else if (partialAlias && 0.8 > bestConfidence) {
        bestMatch = col
        bestConfidence = 0.8
      }
      if (normHeader.includes(normCol) || normCol.includes(normHeader)) {
        if (0.7 > bestConfidence) {
          bestMatch = col
          bestConfidence = 0.7
        }
      }
    }
    if (bestMatch) {
      suggestions.push({ csvHeader: header, suggestedSchemaColumn: bestMatch, confidence: bestConfidence })
    }
  }
  return suggestions
}

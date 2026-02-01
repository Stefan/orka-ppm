// Costbook CSV Import Utilities
// Handles CSV parsing, validation, and mapping to database schema

import { Commitment, Actual, Currency, POStatus, ActualStatus, CSVImportResult, CSVImportError } from '@/types/costbook'

/**
 * Expected column headers for Commitment CSV
 */
export const COMMITMENT_COLUMNS = [
  'po_number',
  'project_id',
  'vendor_id',
  'vendor_name',
  'description',
  'amount',
  'currency',
  'status',
  'issue_date',
  'delivery_date'
] as const

/**
 * Expected column headers for Actual CSV
 */
export const ACTUAL_COLUMNS = [
  'commitment_id',
  'project_id',
  'po_number',
  'vendor_id',
  'vendor_name',
  'description',
  'amount',
  'currency',
  'status',
  'invoice_date',
  'payment_date'
] as const

/**
 * Column mapping for flexible CSV imports
 */
export interface ColumnMapping {
  [csvColumn: string]: string
}

/**
 * Validates CSV file format by checking headers
 */
export async function validateCSVFormat(
  file: File,
  expectedColumns: readonly string[]
): Promise<{ valid: boolean; errors: string[]; headers: string[] }> {
  const errors: string[] = []
  
  try {
    const text = await file.text()
    const lines = text.split('\n')
    
    if (lines.length === 0) {
      return { valid: false, errors: ['File is empty'], headers: [] }
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
    
    // Check for required columns
    const missingColumns: string[] = []
    expectedColumns.forEach(col => {
      // Check for exact match or close match (without underscores/spaces)
      const normalized = col.toLowerCase().replace(/[_\s]/g, '')
      const hasMatch = headers.some(h => 
        h.replace(/[_\s]/g, '') === normalized
      )
      
      if (!hasMatch) {
        missingColumns.push(col)
      }
    })

    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`)
    }

    // Check for data rows
    if (lines.length < 2) {
      errors.push('No data rows found')
    }

    return {
      valid: errors.length === 0,
      errors,
      headers
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      headers: []
    }
  }
}

/**
 * Parses a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Parses CSV file to Commitment objects
 */
export async function parseCSVToCommitments(
  file: File,
  columnMapping?: ColumnMapping
): Promise<{ commitments: Partial<Commitment>[]; errors: CSVImportError[] }> {
  const errors: CSVImportError[] = []
  const commitments: Partial<Commitment>[] = []

  try {
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    
    if (lines.length < 2) {
      return { commitments: [], errors: [{ row: 0, column: '', value: '', error: 'No data rows' }] }
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
    
    // Create header index map
    const headerIndex: { [key: string]: number } = {}
    headers.forEach((h, i) => {
      const normalized = h.replace(/[_\s]/g, '')
      headerIndex[normalized] = i
      headerIndex[h] = i
    })

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const row = i + 1 // 1-indexed for user display
      const values = parseCSVLine(lines[i])
      
      try {
        const commitment = mapRowToCommitment(values, headerIndex, columnMapping)
        
        // Validate required fields
        const validationErrors = validateCommitment(commitment, row)
        if (validationErrors.length > 0) {
          errors.push(...validationErrors)
          continue
        }

        commitments.push(commitment)
      } catch (error) {
        errors.push({
          row,
          column: '',
          value: '',
          error: error instanceof Error ? error.message : 'Parse error'
        })
      }
    }

    return { commitments, errors }
  } catch (error) {
    return {
      commitments: [],
      errors: [{ row: 0, column: '', value: '', error: `File read error: ${error}` }]
    }
  }
}

/**
 * Maps a CSV row to a Commitment object
 */
function mapRowToCommitment(
  values: string[],
  headerIndex: { [key: string]: number },
  columnMapping?: ColumnMapping
): Partial<Commitment> {
  const getValue = (column: string): string => {
    // Apply custom mapping if provided
    const mappedColumn = columnMapping?.[column] || column
    const normalized = mappedColumn.toLowerCase().replace(/[_\s]/g, '')
    const index = headerIndex[normalized] ?? headerIndex[mappedColumn.toLowerCase()]
    return index !== undefined ? values[index]?.trim() || '' : ''
  }

  return {
    po_number: getValue('po_number'),
    project_id: getValue('project_id'),
    vendor_id: getValue('vendor_id'),
    vendor_name: getValue('vendor_name'),
    description: getValue('description'),
    amount: parseFloat(getValue('amount').replace(/[^0-9.-]/g, '')) || 0,
    currency: parseCurrency(getValue('currency')),
    status: parsePOStatus(getValue('status')),
    issue_date: parseDate(getValue('issue_date')),
    delivery_date: parseDate(getValue('delivery_date')) || undefined
  }
}

/**
 * Parses CSV file to Actual objects
 */
export async function parseCSVToActuals(
  file: File,
  columnMapping?: ColumnMapping
): Promise<{ actuals: Partial<Actual>[]; errors: CSVImportError[] }> {
  const errors: CSVImportError[] = []
  const actuals: Partial<Actual>[] = []

  try {
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    
    if (lines.length < 2) {
      return { actuals: [], errors: [{ row: 0, column: '', value: '', error: 'No data rows' }] }
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
    
    const headerIndex: { [key: string]: number } = {}
    headers.forEach((h, i) => {
      const normalized = h.replace(/[_\s]/g, '')
      headerIndex[normalized] = i
      headerIndex[h] = i
    })

    for (let i = 1; i < lines.length; i++) {
      const row = i + 1
      const values = parseCSVLine(lines[i])
      
      try {
        const actual = mapRowToActual(values, headerIndex, columnMapping)
        
        const validationErrors = validateActual(actual, row)
        if (validationErrors.length > 0) {
          errors.push(...validationErrors)
          continue
        }

        actuals.push(actual)
      } catch (error) {
        errors.push({
          row,
          column: '',
          value: '',
          error: error instanceof Error ? error.message : 'Parse error'
        })
      }
    }

    return { actuals, errors }
  } catch (error) {
    return {
      actuals: [],
      errors: [{ row: 0, column: '', value: '', error: `File read error: ${error}` }]
    }
  }
}

/**
 * Maps a CSV row to an Actual object
 */
function mapRowToActual(
  values: string[],
  headerIndex: { [key: string]: number },
  columnMapping?: ColumnMapping
): Partial<Actual> {
  const getValue = (column: string): string => {
    const mappedColumn = columnMapping?.[column] || column
    const normalized = mappedColumn.toLowerCase().replace(/[_\s]/g, '')
    const index = headerIndex[normalized] ?? headerIndex[mappedColumn.toLowerCase()]
    return index !== undefined ? values[index]?.trim() || '' : ''
  }

  return {
    commitment_id: getValue('commitment_id') || undefined,
    project_id: getValue('project_id'),
    po_number: getValue('po_number') || undefined,
    vendor_id: getValue('vendor_id'),
    vendor_name: getValue('vendor_name'),
    description: getValue('description'),
    amount: parseFloat(getValue('amount').replace(/[^0-9.-]/g, '')) || 0,
    currency: parseCurrency(getValue('currency')),
    status: parseActualStatus(getValue('status')),
    invoice_date: parseDate(getValue('invoice_date')),
    payment_date: parseDate(getValue('payment_date')) || undefined
  }
}

/**
 * Validates a Commitment object
 */
function validateCommitment(commitment: Partial<Commitment>, row: number): CSVImportError[] {
  const errors: CSVImportError[] = []

  if (!commitment.po_number) {
    errors.push({ row, column: 'po_number', value: '', error: 'PO number is required' })
  }
  if (!commitment.project_id) {
    errors.push({ row, column: 'project_id', value: '', error: 'Project ID is required' })
  }
  if (!commitment.vendor_id) {
    errors.push({ row, column: 'vendor_id', value: '', error: 'Vendor ID is required' })
  }
  if (!commitment.amount || commitment.amount <= 0) {
    errors.push({ row, column: 'amount', value: String(commitment.amount), error: 'Valid amount is required' })
  }
  if (!commitment.issue_date) {
    errors.push({ row, column: 'issue_date', value: '', error: 'Issue date is required' })
  }

  return errors
}

/**
 * Validates an Actual object
 */
function validateActual(actual: Partial<Actual>, row: number): CSVImportError[] {
  const errors: CSVImportError[] = []

  if (!actual.project_id) {
    errors.push({ row, column: 'project_id', value: '', error: 'Project ID is required' })
  }
  if (!actual.vendor_id) {
    errors.push({ row, column: 'vendor_id', value: '', error: 'Vendor ID is required' })
  }
  if (!actual.amount || actual.amount <= 0) {
    errors.push({ row, column: 'amount', value: String(actual.amount), error: 'Valid amount is required' })
  }
  if (!actual.invoice_date) {
    errors.push({ row, column: 'invoice_date', value: '', error: 'Invoice date is required' })
  }

  return errors
}

/**
 * Parses currency string to Currency enum
 */
function parseCurrency(value: string): Currency {
  const upper = value.toUpperCase().trim()
  if (Object.values(Currency).includes(upper as Currency)) {
    return upper as Currency
  }
  return Currency.USD
}

/**
 * Parses status string to POStatus enum
 */
function parsePOStatus(value: string): POStatus {
  const lower = value.toLowerCase().trim()
  if (Object.values(POStatus).includes(lower as POStatus)) {
    return lower as POStatus
  }
  return POStatus.DRAFT
}

/**
 * Parses status string to ActualStatus enum
 */
function parseActualStatus(value: string): ActualStatus {
  const lower = value.toLowerCase().trim()
  if (Object.values(ActualStatus).includes(lower as ActualStatus)) {
    return lower as ActualStatus
  }
  return ActualStatus.PENDING
}

/**
 * Parses date string to ISO format
 */
function parseDate(value: string): string {
  if (!value) return ''
  
  // Try parsing various date formats
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]
  }
  
  // Try DD/MM/YYYY format
  const parts = value.split(/[\/\-.]/)
  if (parts.length === 3) {
    // Assume DD/MM/YYYY if first part is > 12
    if (parseInt(parts[0], 10) > 12) {
      const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0]
      }
    }
  }
  
  return ''
}

/**
 * Generates a sample CSV template
 */
export function generateCSVTemplate(type: 'commitment' | 'actual'): string {
  const columns = type === 'commitment' ? COMMITMENT_COLUMNS : ACTUAL_COLUMNS
  const header = columns.join(',')
  
  const sampleData = type === 'commitment'
    ? 'PO-2024-001,proj-001,vendor-001,Sample Vendor,Sample Description,10000,USD,draft,2024-01-15,2024-03-15'
    : 'commit-001,proj-001,PO-2024-001,vendor-001,Sample Vendor,Sample Description,5000,USD,pending,2024-02-01,2024-02-15'
  
  return `${header}\n${sampleData}`
}

/**
 * Downloads a CSV template
 */
export function downloadCSVTemplate(type: 'commitment' | 'actual'): void {
  const content = generateCSVTemplate(type)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}s-template.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
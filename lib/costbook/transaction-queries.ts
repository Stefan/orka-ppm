// Costbook Transaction Query Utilities
// Transforms commitments and actuals into a unified Transaction format

import { Commitment, Actual, Transaction, Currency, POStatus, ActualStatus } from '@/types/costbook'
import { supabase } from '@/lib/api/supabase'

/**
 * Transforms a Commitment into a Transaction
 */
export function commitmentToTransaction(commitment: Commitment): Transaction {
  return {
    id: commitment.id,
    project_id: commitment.project_id,
    type: 'commitment',
    amount: commitment.amount,
    currency: commitment.currency,
    vendor_name: commitment.vendor_name,
    description: commitment.description,
    date: commitment.issue_date,
    po_number: commitment.po_number,
    status: commitment.status
  }
}

/**
 * Transforms an Actual into a Transaction
 */
export function actualToTransaction(actual: Actual): Transaction {
  return {
    id: actual.id,
    project_id: actual.project_id,
    type: 'actual',
    amount: actual.amount,
    currency: actual.currency,
    vendor_name: actual.vendor_name,
    description: actual.description,
    date: actual.invoice_date,
    po_number: actual.po_number,
    status: actual.status
  }
}

/**
 * Combines commitments and actuals into a unified transaction list
 */
export function combineTransactions(
  commitments: Commitment[],
  actuals: Actual[]
): Transaction[] {
  const transactions: Transaction[] = [
    ...commitments.map(commitmentToTransaction),
    ...actuals.map(actualToTransaction)
  ]

  // Sort by date descending
  return transactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

/**
 * Filter options for transactions
 */
export interface TransactionFilters {
  projectId?: string
  vendorName?: string
  type?: 'commitment' | 'actual' | 'all'
  status?: POStatus | ActualStatus | 'all'
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  searchTerm?: string
}

/**
 * Applies filters to a transaction list
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter(t => {
    // Filter by project
    if (filters.projectId && t.project_id !== filters.projectId) {
      return false
    }

    // Filter by vendor
    if (filters.vendorName && !t.vendor_name.toLowerCase().includes(filters.vendorName.toLowerCase())) {
      return false
    }

    // Filter by type
    if (filters.type && filters.type !== 'all' && t.type !== filters.type) {
      return false
    }

    // Filter by status
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) {
      return false
    }

    // Filter by date range
    if (filters.startDate && new Date(t.date) < new Date(filters.startDate)) {
      return false
    }
    if (filters.endDate && new Date(t.date) > new Date(filters.endDate)) {
      return false
    }

    // Filter by amount range
    if (filters.minAmount !== undefined && t.amount < filters.minAmount) {
      return false
    }
    if (filters.maxAmount !== undefined && t.amount > filters.maxAmount) {
      return false
    }

    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      const matchesDescription = t.description.toLowerCase().includes(term)
      const matchesVendor = t.vendor_name.toLowerCase().includes(term)
      const matchesPO = t.po_number?.toLowerCase().includes(term)
      
      if (!matchesDescription && !matchesVendor && !matchesPO) {
        return false
      }
    }

    return true
  })
}

/**
 * Sort options for transactions
 */
export type TransactionSortField = 'date' | 'amount' | 'vendor_name' | 'type' | 'status'
export type SortDirection = 'asc' | 'desc'

/**
 * Sorts a transaction list
 */
export function sortTransactions(
  transactions: Transaction[],
  field: TransactionSortField,
  direction: SortDirection
): Transaction[] {
  return [...transactions].sort((a, b) => {
    let comparison = 0
    
    switch (field) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
        break
      case 'amount':
        comparison = a.amount - b.amount
        break
      case 'vendor_name':
        comparison = a.vendor_name.localeCompare(b.vendor_name)
        break
      case 'type':
        comparison = a.type.localeCompare(b.type)
        break
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '')
        break
    }
    
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Groups transactions by PO number for related grouping
 */
export function groupTransactionsByPO(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>()
  
  transactions.forEach(t => {
    const key = t.po_number || 'no-po'
    const existing = groups.get(key) || []
    groups.set(key, [...existing, t])
  })
  
  return groups
}

/**
 * Calculates transaction summary
 */
export function calculateTransactionSummary(transactions: Transaction[]) {
  const commitments = transactions.filter(t => t.type === 'commitment')
  const actuals = transactions.filter(t => t.type === 'actual')
  
  return {
    totalTransactions: transactions.length,
    totalCommitments: commitments.length,
    totalActuals: actuals.length,
    totalCommitmentAmount: commitments.reduce((sum, t) => sum + t.amount, 0),
    totalActualAmount: actuals.reduce((sum, t) => sum + t.amount, 0),
    uniqueVendors: new Set(transactions.map(t => t.vendor_name)).size,
    uniqueProjects: new Set(transactions.map(t => t.project_id)).size
  }
}

/**
 * Fetches all transactions with PO join
 * Combines commitments and actuals from database
 */
export async function fetchTransactionsWithPOJoin(
  filters?: TransactionFilters
): Promise<Transaction[]> {
  try {
    // Fetch commitments
    let commitmentsQuery = supabase.from('commitments').select('*')
    
    if (filters?.projectId) {
      commitmentsQuery = commitmentsQuery.eq('project_id', filters.projectId)
    }
    
    const { data: commitments, error: commitmentsError } = await commitmentsQuery

    if (commitmentsError) {
      console.error('Error fetching commitments:', commitmentsError)
    }

    // Fetch actuals
    let actualsQuery = supabase.from('actuals').select('*')
    
    if (filters?.projectId) {
      actualsQuery = actualsQuery.eq('project_id', filters.projectId)
    }
    
    const { data: actuals, error: actualsError } = await actualsQuery

    if (actualsError) {
      console.error('Error fetching actuals:', actualsError)
    }

    // Combine and transform
    const transactions = combineTransactions(
      (commitments || []).map(c => ({
        ...c,
        currency: c.currency as Currency,
        status: c.status as POStatus
      })),
      (actuals || []).map(a => ({
        ...a,
        currency: a.currency as Currency,
        status: a.status as ActualStatus
      }))
    )

    // Apply remaining filters
    if (filters) {
      return filterTransactions(transactions, filters)
    }

    return transactions
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

/**
 * Mock transactions for development/testing
 */
export function getMockTransactions(): Transaction[] {
  const now = new Date()
  
  return [
    {
      id: 'trans-001',
      project_id: 'proj-001',
      type: 'commitment',
      amount: 25000,
      currency: Currency.USD,
      vendor_name: 'Design Agency Inc',
      description: 'UI/UX Design Services - Phase 1',
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      po_number: 'PO-2024-001',
      status: POStatus.APPROVED
    },
    {
      id: 'trans-002',
      project_id: 'proj-001',
      type: 'actual',
      amount: 12500,
      currency: Currency.USD,
      vendor_name: 'Design Agency Inc',
      description: 'Initial Payment - UI/UX Design',
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      po_number: 'PO-2024-001',
      status: ActualStatus.APPROVED
    },
    {
      id: 'trans-003',
      project_id: 'proj-001',
      type: 'commitment',
      amount: 40000,
      currency: Currency.USD,
      vendor_name: 'Dev Team LLC',
      description: 'Frontend Development Services',
      date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      po_number: 'PO-2024-002',
      status: POStatus.ISSUED
    },
    {
      id: 'trans-004',
      project_id: 'proj-002',
      type: 'commitment',
      amount: 60000,
      currency: Currency.USD,
      vendor_name: 'Mobile Experts',
      description: 'iOS App Development',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      po_number: 'PO-2024-003',
      status: POStatus.APPROVED
    },
    {
      id: 'trans-005',
      project_id: 'proj-002',
      type: 'actual',
      amount: 20000,
      currency: Currency.USD,
      vendor_name: 'Mobile Experts',
      description: 'Milestone 1 Payment - iOS Development',
      date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      po_number: 'PO-2024-003',
      status: ActualStatus.APPROVED
    },
    {
      id: 'trans-006',
      project_id: 'proj-003',
      type: 'commitment',
      amount: 15000,
      currency: Currency.EUR,
      vendor_name: 'Data Migration Co',
      description: 'Legacy System Data Migration',
      date: now.toISOString(),
      po_number: 'PO-2024-004',
      status: POStatus.DRAFT
    }
  ]
}
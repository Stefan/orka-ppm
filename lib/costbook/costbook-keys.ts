// Costbook query key factory (no React Query dependency)
// Used by costbook-queries and by tests that assert cache key semantics.

import type { Currency } from '@/types/costbook'
import type { TransactionFilters } from './transaction-queries'

export const costbookKeys = {
  all: ['costbook'] as const,
  projects: () => [...costbookKeys.all, 'projects'] as const,
  projectsWithFinancials: () => [...costbookKeys.projects(), 'financials'] as const,
  project: (id: string) => [...costbookKeys.projects(), id] as const,
  commitments: () => [...costbookKeys.all, 'commitments'] as const,
  commitmentsByProject: (projectId: string) => [...costbookKeys.commitments(), projectId] as const,
  actuals: () => [...costbookKeys.all, 'actuals'] as const,
  actualsByProject: (projectId: string) => [...costbookKeys.actuals(), projectId] as const,
  transactions: (filters?: TransactionFilters) => [...costbookKeys.all, 'transactions', filters] as const,
  kpis: (currency: Currency) => [...costbookKeys.all, 'kpis', currency] as const,
}

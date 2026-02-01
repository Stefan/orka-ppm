// Costbook React Query Hooks
// Provides data fetching with caching, refetching, and suspense support

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProjectsWithFinancials,
  fetchProjectWithFinancials,
  fetchCommitmentsByProject,
  fetchActualsByProject,
  fetchAllCommitments,
  fetchAllActuals,
  createCommitment,
  createActual,
  getMockProjectsWithFinancials,
  getMockCommitments,
  getMockActuals
} from './supabase-queries'
import { fetchTransactionsWithPOJoin, getMockTransactions, TransactionFilters } from './transaction-queries'
import { ProjectWithFinancials, Commitment, Actual, Transaction, Currency } from '@/types/costbook'
import { calculateKPIs } from '@/lib/costbook-calculations'
import { convertCurrency } from '@/lib/currency-utils'

// Query Keys
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

// Default options
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 30 * 60 * 1000 // 30 minutes

/**
 * Hook to fetch all projects with financial data
 */
export function useProjectsWithFinancials(options?: {
  useMockData?: boolean
  enabled?: boolean
  staleTime?: number
}) {
  const { useMockData = false, enabled = true, staleTime = DEFAULT_STALE_TIME } = options || {}

  return useQuery({
    queryKey: costbookKeys.projectsWithFinancials(),
    queryFn: async () => {
      if (useMockData) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300))
        return getMockProjectsWithFinancials()
      }
      return fetchProjectsWithFinancials()
    },
    enabled,
    staleTime,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch a single project with financial data
 */
export function useProjectWithFinancials(
  projectId: string,
  options?: {
    useMockData?: boolean
    enabled?: boolean
  }
) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.project(projectId),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200))
        const projects = getMockProjectsWithFinancials()
        return projects.find(p => p.id === projectId) || null
      }
      return fetchProjectWithFinancials(projectId)
    },
    enabled: enabled && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch commitments for a project
 */
export function useCommitmentsByProject(
  projectId: string,
  options?: {
    useMockData?: boolean
    enabled?: boolean
  }
) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.commitmentsByProject(projectId),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200))
        return getMockCommitments().filter(c => c.project_id === projectId)
      }
      return fetchCommitmentsByProject(projectId)
    },
    enabled: enabled && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch actuals for a project
 */
export function useActualsByProject(
  projectId: string,
  options?: {
    useMockData?: boolean
    enabled?: boolean
  }
) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.actualsByProject(projectId),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200))
        return getMockActuals().filter(a => a.project_id === projectId)
      }
      return fetchActualsByProject(projectId)
    },
    enabled: enabled && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch all commitments
 */
export function useAllCommitments(options?: {
  useMockData?: boolean
  enabled?: boolean
}) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.commitments(),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300))
        return getMockCommitments()
      }
      return fetchAllCommitments()
    },
    enabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch all actuals
 */
export function useAllActuals(options?: {
  useMockData?: boolean
  enabled?: boolean
}) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.actuals(),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300))
        return getMockActuals()
      }
      return fetchAllActuals()
    },
    enabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to fetch transactions with filters
 */
export function useTransactions(
  filters?: TransactionFilters,
  options?: {
    useMockData?: boolean
    enabled?: boolean
  }
) {
  const { useMockData = false, enabled = true } = options || {}

  return useQuery({
    queryKey: costbookKeys.transactions(filters),
    queryFn: async () => {
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300))
        return getMockTransactions()
      }
      return fetchTransactionsWithPOJoin(filters)
    },
    enabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME
  })
}

/**
 * Hook to calculate and cache KPIs with currency conversion
 */
export function useKPIs(
  projects: ProjectWithFinancials[] | undefined,
  displayCurrency: Currency,
  baseCurrency: Currency = Currency.USD
) {
  return useQuery({
    queryKey: costbookKeys.kpis(displayCurrency),
    queryFn: () => {
      if (!projects) {
        return {
          total_budget: 0,
          total_commitments: 0,
          total_actuals: 0,
          total_spend: 0,
          net_variance: 0,
          over_budget_count: 0,
          under_budget_count: 0
        }
      }

      // Convert projects to display currency
      const convertedProjects = displayCurrency === baseCurrency
        ? projects
        : projects.map(p => ({
            ...p,
            budget: convertCurrency(p.budget, baseCurrency, displayCurrency),
            total_commitments: convertCurrency(p.total_commitments, baseCurrency, displayCurrency),
            total_actuals: convertCurrency(p.total_actuals, baseCurrency, displayCurrency),
            total_spend: convertCurrency(p.total_spend, baseCurrency, displayCurrency),
            variance: convertCurrency(p.variance, baseCurrency, displayCurrency)
          }))

      return calculateKPIs(convertedProjects)
    },
    enabled: !!projects,
    staleTime: Infinity // KPIs only change when underlying data changes
  })
}

/**
 * Mutation hook to create a new commitment
 */
export function useCreateCommitment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commitment: Omit<Commitment, 'id' | 'created_at' | 'updated_at'>) => 
      createCommitment(commitment),
    onSuccess: (newCommitment) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: costbookKeys.commitments() })
      queryClient.invalidateQueries({ queryKey: costbookKeys.projectsWithFinancials() })
      
      if (newCommitment.project_id) {
        queryClient.invalidateQueries({ 
          queryKey: costbookKeys.commitmentsByProject(newCommitment.project_id) 
        })
        queryClient.invalidateQueries({ 
          queryKey: costbookKeys.project(newCommitment.project_id) 
        })
      }
    }
  })
}

/**
 * Mutation hook to create a new actual
 */
export function useCreateActual() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (actual: Omit<Actual, 'id' | 'created_at' | 'updated_at'>) => 
      createActual(actual),
    onSuccess: (newActual) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: costbookKeys.actuals() })
      queryClient.invalidateQueries({ queryKey: costbookKeys.projectsWithFinancials() })
      
      if (newActual.project_id) {
        queryClient.invalidateQueries({ 
          queryKey: costbookKeys.actualsByProject(newActual.project_id) 
        })
        queryClient.invalidateQueries({ 
          queryKey: costbookKeys.project(newActual.project_id) 
        })
      }
    }
  })
}

/**
 * Hook to refetch all costbook data
 */
export function useRefreshCostbookData() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: costbookKeys.all })
  }
}

/**
 * Hook to prefetch project data for better UX
 */
export function usePrefetchProject(projectId: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: costbookKeys.project(projectId),
      queryFn: () => fetchProjectWithFinancials(projectId),
      staleTime: DEFAULT_STALE_TIME
    })
    
    queryClient.prefetchQuery({
      queryKey: costbookKeys.commitmentsByProject(projectId),
      queryFn: () => fetchCommitmentsByProject(projectId),
      staleTime: DEFAULT_STALE_TIME
    })
    
    queryClient.prefetchQuery({
      queryKey: costbookKeys.actualsByProject(projectId),
      queryFn: () => fetchActualsByProject(projectId),
      staleTime: DEFAULT_STALE_TIME
    })
  }
}
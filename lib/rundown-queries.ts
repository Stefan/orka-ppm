// React Query Hooks for Rundown Profiles
// Manages data fetching and caching for rundown profile operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RundownProfile,
  GenerationResult,
  RundownProfileSummary,
  GenerateProfilesInput,
  RundownProfilesQuery,
  RundownStatus,
  ProfileType
} from '@/types/rundown'

// Query keys for cache management
export const rundownKeys = {
  all: ['rundown'] as const,
  profiles: (projectId: string) => [...rundownKeys.all, 'profiles', projectId] as const,
  profilesByScenario: (projectId: string, scenario: string) => 
    [...rundownKeys.profiles(projectId), scenario] as const,
  summary: (projectId: string) => [...rundownKeys.all, 'summary', projectId] as const,
  status: () => [...rundownKeys.all, 'status'] as const,
  allProfiles: (projectIds: string[]) => [...rundownKeys.all, 'batch', projectIds] as const,
}

/**
 * Base API URL
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

/**
 * Helper to make authenticated requests
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || `Request failed: ${response.status}`)
  }
  
  return response.json()
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch rundown profiles for a project
 */
export async function fetchRundownProfiles(
  query: RundownProfilesQuery
): Promise<{ profiles: RundownProfile[]; total_count: number }> {
  const params = new URLSearchParams()
  if (query.profile_type) params.set('profile_type', query.profile_type)
  if (query.scenario_name) params.set('scenario_name', query.scenario_name)
  if (query.from_month) params.set('from_month', query.from_month)
  if (query.to_month) params.set('to_month', query.to_month)
  
  const queryString = params.toString()
  const url = `/api/rundown/profiles/${query.project_id}${queryString ? `?${queryString}` : ''}`
  
  return fetchWithAuth(url)
}

/**
 * Fetch rundown profiles for multiple projects
 */
export async function fetchMultipleProfiles(
  projectIds: string[],
  profileType: string = 'standard',
  scenarioName: string = 'baseline'
): Promise<Record<string, RundownProfile[]>> {
  const params = new URLSearchParams()
  projectIds.forEach(id => params.append('project_ids', id))
  params.set('profile_type', profileType)
  params.set('scenario_name', scenarioName)
  
  const response = await fetchWithAuth<{
    profiles_by_project: Record<string, RundownProfile[]>
  }>(`/api/rundown/profiles?${params.toString()}`)
  
  return response.profiles_by_project
}

/**
 * Fetch rundown summary for a project
 */
export async function fetchRundownSummary(
  projectId: string,
  scenarioName: string = 'baseline'
): Promise<RundownProfileSummary> {
  return fetchWithAuth(
    `/api/rundown/summary/${projectId}?scenario_name=${scenarioName}`
  )
}

/**
 * Generate rundown profiles
 */
export async function generateProfiles(
  input: GenerateProfilesInput
): Promise<GenerationResult> {
  return fetchWithAuth('/api/rundown/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Generate profiles asynchronously
 */
export async function generateProfilesAsync(
  input: GenerateProfilesInput
): Promise<{ message: string; execution_id: string }> {
  return fetchWithAuth('/api/rundown/generate/async', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Get generation status
 */
export async function fetchGenerationStatus(): Promise<RundownStatus> {
  return fetchWithAuth('/api/rundown/status')
}

/**
 * Delete rundown profiles for a project
 */
export async function deleteProfiles(
  projectId: string,
  scenarioName?: string
): Promise<void> {
  const params = scenarioName ? `?scenario_name=${scenarioName}` : ''
  return fetchWithAuth(`/api/rundown/profiles/${projectId}${params}`, {
    method: 'DELETE',
  })
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch rundown profiles for a single project
 */
export function useRundownProfiles(
  projectId: string,
  options?: {
    profileType?: string
    scenarioName?: string
    enabled?: boolean
  }
) {
  const { profileType = 'standard', scenarioName = 'baseline', enabled = true } = options || {}
  
  return useQuery({
    queryKey: rundownKeys.profilesByScenario(projectId, scenarioName),
    queryFn: () => fetchRundownProfiles({
      project_id: projectId,
      profile_type: profileType as ProfileType,
      scenario_name: scenarioName,
    }),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  })
}

/**
 * Hook to fetch rundown profiles for multiple projects
 */
export function useAllRundownProfiles(
  projectIds: string[],
  options?: {
    profileType?: string
    scenarioName?: string
    enabled?: boolean
  }
) {
  const { profileType = 'standard', scenarioName = 'baseline', enabled = true } = options || {}
  
  return useQuery({
    queryKey: rundownKeys.allProfiles(projectIds),
    queryFn: () => fetchMultipleProfiles(projectIds, profileType, scenarioName),
    enabled: enabled && projectIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to fetch rundown summary
 */
export function useRundownSummary(
  projectId: string,
  options?: {
    scenarioName?: string
    enabled?: boolean
  }
) {
  const { scenarioName = 'baseline', enabled = true } = options || {}
  
  return useQuery({
    queryKey: rundownKeys.summary(projectId),
    queryFn: () => fetchRundownSummary(projectId, scenarioName),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to get generation status
 */
export function useGenerationStatus() {
  return useQuery({
    queryKey: rundownKeys.status(),
    queryFn: fetchGenerationStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

/**
 * Mutation hook to generate rundown profiles
 */
export function useGenerateRundownProfiles() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: generateProfiles,
    onSuccess: (result, variables) => {
      // Invalidate relevant queries
      if (variables.project_id) {
        queryClient.invalidateQueries({
          queryKey: rundownKeys.profiles(variables.project_id)
        })
        queryClient.invalidateQueries({
          queryKey: rundownKeys.summary(variables.project_id)
        })
      } else {
        // Invalidate all rundown queries
        queryClient.invalidateQueries({
          queryKey: rundownKeys.all
        })
      }
    },
  })
}

/**
 * Mutation hook to generate profiles asynchronously
 */
export function useGenerateRundownProfilesAsync() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: generateProfilesAsync,
    onSuccess: () => {
      // Invalidate status query to trigger refresh
      queryClient.invalidateQueries({
        queryKey: rundownKeys.status()
      })
    },
  })
}

/**
 * Mutation hook to delete profiles
 */
export function useDeleteRundownProfiles() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, scenarioName }: { projectId: string; scenarioName?: string }) => 
      deleteProfiles(projectId, scenarioName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rundownKeys.profiles(variables.projectId)
      })
      queryClient.invalidateQueries({
        queryKey: rundownKeys.summary(variables.projectId)
      })
    },
  })
}

/**
 * Hook to prefetch rundown profiles
 */
export function usePrefetchRundownProfiles() {
  const queryClient = useQueryClient()
  
  return (projectId: string, scenarioName: string = 'baseline') => {
    queryClient.prefetchQuery({
      queryKey: rundownKeys.profilesByScenario(projectId, scenarioName),
      queryFn: () => fetchRundownProfiles({
        project_id: projectId,
        scenario_name: scenarioName,
      }),
      staleTime: 5 * 60 * 1000,
    })
  }
}

// ============================================
// Mock Data for Development
// ============================================

/**
 * Generate mock rundown profiles for development
 */
export function generateMockProfiles(
  projectId: string,
  startMonth: string = '202401',
  months: number = 12,
  budget: number = 500000
): RundownProfile[] {
  const profiles: RundownProfile[] = []
  const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '')
  const monthlyIncrement = budget / months
  
  let year = parseInt(startMonth.slice(0, 4))
  let month = parseInt(startMonth.slice(4, 6))
  
  for (let i = 0; i < months; i++) {
    const monthStr = `${year}${month.toString().padStart(2, '0')}`
    const isFuture = monthStr > currentMonth
    
    // Planned value (linear)
    const plannedValue = monthlyIncrement * (i + 1)
    
    // Actual value (with some variance)
    const variance = (Math.random() - 0.3) * 0.15 // Slight tendency to be over budget
    const actualValue = isFuture ? plannedValue : plannedValue * (1 + variance)
    
    // Predicted value (only for future months)
    const predictedValue = isFuture 
      ? plannedValue * (1 + (Math.random() - 0.5) * 0.2) 
      : null
    
    profiles.push({
      id: `mock-${projectId}-${monthStr}`,
      project_id: projectId,
      month: monthStr,
      planned_value: Math.round(plannedValue),
      actual_value: Math.round(actualValue),
      predicted_value: predictedValue ? Math.round(predictedValue) : null,
      profile_type: 'standard',
      scenario_name: 'baseline',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    
    // Advance month
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  
  return profiles
}

export default useRundownProfiles

'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface ProjectListItem {
  id: string
  name: string
  description?: string
  status: string
  start_date?: string
  end_date?: string
  budget?: number
  actual_cost?: number
  portfolio_id?: string
  health?: string
  created_at?: string
  updated_at?: string
  workflow_instance?: {
    id: string
    status: string
    current_step: number
    workflow_name: string
    pending_approvals: number
  }
}

async function fetchProjects(accessToken: string): Promise<ProjectListItem[]> {
  const response = await fetch('/api/projects', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) throw new Error('Failed to fetch projects')
  const data = await response.json()
  return Array.isArray(data) ? data : (data.projects ?? [])
}

const PROJECTS_QUERY_KEY = ['projects'] as const

/**
 * Fetches projects list with React Query (deduplication + client cache).
 * Keyed by userId so cache is per-user; staleTime from QueryProvider (5 min).
 */
export function useProjectsQuery(accessToken: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, userId ?? ''],
    queryFn: () => fetchProjects(accessToken!),
    enabled: Boolean(accessToken && userId),
    staleTime: 60 * 1000, // 1 min for projects list
  })
}

export function useInvalidateProjects() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
}

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

async function fetchProjects(
  accessToken: string,
  portfolioId?: string | null
): Promise<ProjectListItem[]> {
  const url = portfolioId
    ? `/api/projects?portfolio_id=${encodeURIComponent(portfolioId)}`
    : '/api/projects'
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) throw new Error('Failed to fetch projects')
  const data = await response.json()
  return Array.isArray(data) ? data : (data.items ?? data.projects ?? [])
}

const PROJECTS_QUERY_KEY = ['projects'] as const

/**
 * Fetches projects list with React Query (deduplication + client cache).
 * Keyed by userId and optional portfolioId; when portfolioId is set, list is scoped to that portfolio.
 */
export function useProjectsQuery(
  accessToken: string | undefined,
  userId: string | undefined,
  portfolioId?: string | null
) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, userId ?? '', portfolioId ?? ''],
    queryFn: () => fetchProjects(accessToken!, portfolioId),
    enabled: Boolean(accessToken && userId),
    staleTime: 60 * 1000, // 1 min for projects list
  })
}

export function useInvalidateProjects() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
}

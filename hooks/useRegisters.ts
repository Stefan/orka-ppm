'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiUrl } from '@/lib/api/client'
import type {
  RegisterEntry,
  RegisterListResponse,
  RegisterFilters,
  RegisterType,
  AIRecommendResponse,
} from '@/types/registers'

const REGISTERS_QUERY_KEY = 'registers'

function getRegistersUrl(type: RegisterType, filters?: RegisterFilters): string {
  const params = new URLSearchParams()
  if (filters?.project_id) params.set('project_id', filters.project_id)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.limit != null) params.set('limit', String(filters.limit))
  if (filters?.offset != null) params.set('offset', String(filters.offset))
  const q = params.toString()
  return getApiUrl(`/api/registers/${type}${q ? `?${q}` : ''}`)
}

async function fetchRegisters(
  type: RegisterType,
  filters: RegisterFilters | undefined,
  accessToken: string
): Promise<RegisterListResponse> {
  const url = getRegistersUrl(type, filters)
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || 'Failed to fetch registers')
  }
  return res.json()
}

export function useRegisters(
  type: RegisterType,
  filters: RegisterFilters | undefined,
  accessToken: string | undefined
) {
  return useQuery({
    queryKey: [REGISTERS_QUERY_KEY, type, filters],
    queryFn: () => fetchRegisters(type, filters ?? {}, accessToken!),
    enabled: !!type && !!accessToken,
    staleTime: 60 * 1000,
  })
}

export function useRegister(
  type: RegisterType,
  id: string | null,
  accessToken: string | undefined
) {
  return useQuery({
    queryKey: [REGISTERS_QUERY_KEY, type, id],
    queryFn: async () => {
      const url = getApiUrl(`/api/registers/${type}/${id}`)
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error('Failed to fetch register')
      return res.json() as Promise<RegisterEntry>
    },
    enabled: !!type && !!id && !!accessToken,
  })
}

export function useCreateRegister(type: RegisterType, accessToken: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { project_id?: string; data: Record<string, unknown>; status?: string }) => {
      const url = getApiUrl(`/api/registers/${type}`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to create')
      }
      return res.json() as Promise<RegisterEntry>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REGISTERS_QUERY_KEY, type] })
    },
  })
}

export function useUpdateRegister(type: RegisterType, accessToken: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
      status,
      project_id,
    }: {
      id: string
      data?: Record<string, unknown>
      status?: string
      project_id?: string | null
    }) => {
      const url = getApiUrl(`/api/registers/${type}/${id}`)
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, status, project_id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to update')
      }
      return res.json() as Promise<RegisterEntry>
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: [REGISTERS_QUERY_KEY, type] })
      queryClient.invalidateQueries({ queryKey: [REGISTERS_QUERY_KEY, type, v.id] })
    },
  })
}

export function useDeleteRegister(type: RegisterType, accessToken: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const url = getApiUrl(`/api/registers/${type}/${id}`)
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to delete')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REGISTERS_QUERY_KEY, type] })
    },
  })
}

export function useRegisterRecommend(type: RegisterType, accessToken: string | undefined) {
  return useMutation({
    mutationFn: async (context?: { project_id?: string; context?: Record<string, unknown> }) => {
      const url = getApiUrl(`/api/registers/${type}/ai-recommend`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context ?? {}),
      })
      if (!res.ok) throw new Error('Failed to get recommendation')
      return res.json() as Promise<AIRecommendResponse>
    },
  })
}

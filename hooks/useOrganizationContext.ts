/**
 * Organization context for RLS / sub-orgs (React Query).
 * Spec: .kiro/specs/rls-sub-organizations/ Task 3.3
 * Cache + staleTime; invalidate on logout.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiUrl } from '@/lib/api'
import type { OrganizationContextValue } from '@/app/providers/SupabaseAuthProvider'

const QUERY_KEY = ['organizationContext'] as const
const STALE_TIME_MS = 5 * 60 * 1000

async function fetchOrganizationContext(accessToken: string): Promise<OrganizationContextValue> {
  const res = await fetch(getApiUrl('/api/users/me/organization-context'), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch organization context')
  const data = await res.json()
  return {
    organizationId: data.organizationId ?? null,
    organizationPath: data.organizationPath ?? null,
    isOrgAdmin: Boolean(data.isAdmin),
  }
}

export function useOrganizationContext(accessToken: string | undefined) {
  const query = useQuery({
    queryKey: [...QUERY_KEY, accessToken ?? ''],
    queryFn: () => fetchOrganizationContext(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: STALE_TIME_MS,
  })
  return {
    organizationContext: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useInvalidateOrganizationContext() {
  const queryClient = useQueryClient()
  return () => queryClient.removeQueries({ queryKey: QUERY_KEY })
}

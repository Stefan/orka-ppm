/**
 * ERP & System Integrations – frontend types and helpers
 * Spec: .kiro/specs/integrations-erp/
 */

export const INTEGRATION_SYSTEMS = [
  'sap',
  'microsoft',
  'oracle',
  'jira',
  'slack',
] as const

export type IntegrationSystem = (typeof INTEGRATION_SYSTEMS)[number]

export const SYSTEM_DISPLAY_NAMES: Record<IntegrationSystem, string> = {
  sap: 'SAP',
  microsoft: 'Microsoft Dynamics / PPM',
  oracle: 'Oracle NetSuite',
  jira: 'Jira',
  slack: 'Slack',
}

export interface SyncResult {
  adapter: string
  entity: 'commitments' | 'actuals'
  total: number
  inserted: number
  updated: number
  errors: string[]
  synced_at?: string
}

export interface IntegrationConfigItem {
  system: IntegrationSystem
  enabled: boolean
  last_sync?: string
  last_error?: string
}

export interface IntegrationConfigPayload {
  api_url?: string
  api_key?: string
  client?: string
  webhook_url?: string
  base_url?: string
  token?: string
  [key: string]: string | undefined
}

/**
 * Trigger ERP/Integration sync via backend (Next.js API → FastAPI).
 */
export async function triggerSync(
  params: {
    adapter?: IntegrationSystem | 'csv'
    entity?: 'commitments' | 'actuals'
    organization_id?: string
  },
  accessToken: string
): Promise<SyncResult> {
  const { getApiUrl } = await import('@/lib/api')
  const adapter = params.adapter ?? 'sap'
  const entity = params.entity ?? 'commitments'
  const url = getApiUrl('/api/integrations/sync')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      system: adapter,
      entity,
      organization_id: params.organization_id ?? undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText)
  }
  return {
    adapter: (data as SyncResult).adapter ?? adapter,
    entity: (data as SyncResult).entity ?? entity,
    total: (data as SyncResult).total ?? 0,
    inserted: (data as SyncResult).inserted ?? 0,
    updated: (data as SyncResult).updated ?? 0,
    errors: Array.isArray((data as SyncResult).errors) ? (data as SyncResult).errors : [],
    synced_at: (data as SyncResult).synced_at,
  }
}

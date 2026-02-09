/**
 * Change Orders API client
 *
 * Passes Supabase JWT as Bearer token for RBAC. Backend expects Authorization header.
 */

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''

/** Get current session access token for API auth (client-side only) */
async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const { supabase } = await import('@/lib/api/supabase-minimal')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const url = `${API_BASE}/api${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }

  const token = await getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = Array.isArray(err.detail) ? err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ') : err.detail
    throw new Error(detail || res.statusText || `Request failed: ${res.status}`)
  }
  return res.json()
}

export interface ChangeOrder {
  id: string
  project_id: string
  change_order_number: string
  title: string
  description: string
  justification: string
  change_category: string
  change_source: string
  impact_type: string[]
  priority: string
  status: string
  original_contract_value: number
  proposed_cost_impact: number
  approved_cost_impact?: number
  proposed_schedule_impact_days: number
  approved_schedule_impact_days?: number
  created_by: string
  submitted_date?: string
  required_approval_date?: string
  approved_date?: string
  implementation_date?: string
  contract_reference?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChangeOrderDetail extends ChangeOrder {
  line_items: ChangeOrderLineItem[]
}

export interface ChangeOrderLineItem {
  id: string
  change_order_id: string
  line_number: number
  description: string
  work_package_id?: string | null
  trade_category: string
  unit_of_measure: string
  quantity: number
  unit_rate: number
  extended_cost: number
  total_cost: number
  cost_category: string
  is_add: boolean
}

export interface ChangeOrderCreate {
  project_id: string
  title: string
  description: string
  justification: string
  change_category: string
  change_source: string
  impact_type?: string[]
  priority?: string
  original_contract_value: number
  proposed_schedule_impact_days?: number
  contract_reference?: string
  line_items?: Array<{
    description: string
    trade_category: string
    unit_of_measure: string
    quantity: number
    unit_rate: number
    markup_percentage?: number
    overhead_percentage?: number
    contingency_percentage?: number
    cost_category: string
    is_add?: boolean
    work_package_id?: string | null
  }>
}

export interface CostImpactAnalysis {
  id: string
  total_cost_impact: number
  direct_costs: Record<string, number>
  indirect_costs: Record<string, number>
  confidence_level: number
  pricing_method: string
}

export interface CostScenario {
  scenario_name: string
  total_cost: number
  breakdown: Record<string, number>
  confidence_level: number
}

export interface PendingApproval {
  id: string
  change_order_id: string
  change_order_number: string
  change_order_title: string
  approval_level: number
  proposed_cost_impact: number
  due_date?: string | null
}

export const changeOrdersApi = {
  list: (projectId: string, params?: { status?: string; category?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return fetchWithAuth(`/change-orders/${projectId}${q ? `?${q}` : ''}`) as Promise<ChangeOrder[]>
  },
  get: (id: string) =>
    fetchWithAuth(`/change-orders/details/${id}`) as Promise<ChangeOrderDetail>,
  create: (data: ChangeOrderCreate) =>
    fetchWithAuth(`/change-orders/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<ChangeOrder>,
  update: (id: string, data: Partial<ChangeOrderCreate>) =>
    fetchWithAuth(`/change-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<ChangeOrder>,
  submit: (id: string) =>
    fetchWithAuth(`/change-orders/${id}/submit`, { method: 'POST' }) as Promise<ChangeOrder>,
  getCostAnalysis: (changeOrderId: string) =>
    fetchWithAuth(`/change-orders/${changeOrderId}/cost-analysis`) as Promise<CostImpactAnalysis | null>,
  createCostAnalysis: (changeOrderId: string, data: object) =>
    fetchWithAuth(`/change-orders/${changeOrderId}/cost-analysis`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<CostImpactAnalysis>,
  getCostScenarios: (changeOrderId: string, scenarios?: string[]) =>
    fetchWithAuth(`/change-orders/${changeOrderId}/cost-scenarios`, {
      method: 'POST',
      body: JSON.stringify({ scenarios: scenarios ?? ['optimistic', 'most_likely', 'pessimistic'] }),
    }) as Promise<CostScenario[]>,
  getDashboard: (projectId: string) =>
    fetchWithAuth(`/change-analytics/dashboard/${projectId}`) as Promise<{
      summary: Record<string, unknown>
      recent_change_orders: ChangeOrder[]
      pending_approvals: unknown[]
      cost_impact_summary: Record<string, unknown>
    }>,
  getMetrics: (projectId: string, period?: string) =>
    fetchWithAuth(`/change-analytics/metrics/${projectId}${period ? `?period=${period}` : ''}`) as Promise<Record<string, unknown>>,
  initiateWorkflow: (changeOrderId: string) =>
    fetchWithAuth(`/change-approvals/workflow/${changeOrderId}`, { method: 'POST' }) as Promise<unknown>,
  getPendingApprovals: (userId: string) =>
    fetchWithAuth(`/change-approvals/pending/${userId}`) as Promise<PendingApproval[]>,
  approve: (approvalId: string, payload?: { comments?: string; conditions?: string[] }) =>
    fetchWithAuth(`/change-approvals/approve/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }) as Promise<unknown>,
  reject: (approvalId: string, payload: { comments: string; conditions?: string[] }) =>
    fetchWithAuth(`/change-approvals/reject/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }) as Promise<unknown>,
  delegate: (approvalId: string, delegateToUserId: string) =>
    fetchWithAuth(`/change-approvals/delegate/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify({ delegate_to_user_id: delegateToUserId }),
    }) as Promise<unknown>,
  getWorkflowStatus: (changeOrderId: string) =>
    fetchWithAuth(`/change-approvals/workflow-status/${changeOrderId}`) as Promise<{
      status: string
      approval_levels: Array<{ level: number; role: string; status: string }>
      is_complete: boolean
    }>,
  /** AI-assisted cost impact estimate from description and line items (rule-based). */
  aiEstimate: (body: {
    description: string
    line_items?: Array<{ description?: string; quantity: number; unit_rate: number; cost_category?: string }>
    change_category?: string
  }) =>
    fetchWithAuth(`/change-orders/ai-estimate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Promise<{
      estimated_min: number
      estimated_max: number
      confidence: number
      method: string
      notes?: string[]
    }>,
  /** AI approval recommendations (hints only). */
  getAIRecommendations: (changeOrderId: string, includeVarianceAudit: boolean = true) =>
    fetchWithAuth(
      `/change-approvals/change-orders/${changeOrderId}/ai-recommendations?include_variance_audit=${includeVarianceAudit}`
    ) as Promise<{
      recommendations: Array<{ text: string; type: string }>
      variance_audit_context?: Record<string, unknown>
    }>,
}

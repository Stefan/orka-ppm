/**
 * Unified Registers (Register-Arten) types.
 * Spec: .kiro/specs/registers-unified/
 */

export const REGISTER_TYPES = [
  'risk',
  'change',
  'cost',
  'issue',
  'benefits',
  'lessons_learned',
  'decision',
  'opportunities',
] as const

export type RegisterType = (typeof REGISTER_TYPES)[number]

export interface RegisterEntry {
  id: string
  type: RegisterType
  project_id: string | null
  organization_id: string
  data: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

export interface RegisterListResponse {
  items: RegisterEntry[]
  total: number
  limit: number
  offset: number
}

export interface RegisterFilters {
  project_id?: string
  status?: string
  limit?: number
  offset?: number
}

export interface AIRecommendResponse {
  data: Record<string, unknown>
  explanation?: string
}

export const REGISTER_TYPE_LABELS: Record<RegisterType, string> = {
  risk: 'Risk',
  change: 'Change',
  cost: 'Cost',
  issue: 'Issue / Action',
  benefits: 'Benefits',
  lessons_learned: 'Lessons Learned',
  decision: 'Decision',
  opportunities: 'Opportunities',
}

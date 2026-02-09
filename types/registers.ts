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
  task_id?: string | null
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
  task_id?: string
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

/** Field definition for type-specific forms (Spec: RegisterInlinePanel, no modals) */
export interface RegisterFieldSchema {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  optional?: boolean
  min?: number
  max?: number
  step?: number
}

/** Nested sub-grid: key in data that holds array of items (e.g. mitigations for risk) */
export interface RegisterNestedSchema {
  key: string
  label: string
  columns: { key: string; label: string }[]
}

export interface RegisterTypeSchema {
  fields: RegisterFieldSchema[]
  nested?: RegisterNestedSchema
}

/** Type-specific form and nested grid config. Spec: R3.3 Inline-Panels, Task 3.6 Nested Grids */
export const REGISTER_TYPE_SCHEMAS: Record<RegisterType, RegisterTypeSchema> = {
  risk: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'probability', label: 'Probability (0–1)', type: 'number', min: 0, max: 1, step: 0.1 },
      { key: 'impact', label: 'Impact (0–1)', type: 'number', min: 0, max: 1, step: 0.1 },
      { key: 'owner', label: 'Owner', type: 'text', optional: true },
    ],
    nested: { key: 'mitigations', label: 'Mitigations', columns: [{ key: 'action', label: 'Action' }, { key: 'status', label: 'Status' }] },
  },
  change: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'impact_area', label: 'Impact area', type: 'select', options: [{ value: 'schedule', label: 'Schedule' }, { value: 'cost', label: 'Cost' }, { value: 'scope', label: 'Scope' }] },
      { key: 'requested_by', label: 'Requested by', type: 'text', optional: true },
    ],
  },
  cost: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'eac', label: 'EAC', type: 'number', optional: true },
      { key: 'etc', label: 'ETC', type: 'number', optional: true },
      { key: 'notes', label: 'Notes', type: 'textarea', optional: true },
    ],
  },
  issue: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }] },
      { key: 'owner', label: 'Owner', type: 'text', optional: true },
    ],
    nested: { key: 'actions', label: 'Actions', columns: [{ key: 'action', label: 'Action' }, { key: 'due', label: 'Due' }] },
  },
  benefits: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'roi_forecast', label: 'ROI forecast', type: 'number', optional: true },
      { key: 'owner', label: 'Owner', type: 'text', optional: true },
    ],
  },
  lessons_learned: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'summary', label: 'Summary', type: 'textarea', optional: true },
      { key: 'category', label: 'Category', type: 'text', optional: true },
    ],
  },
  decision: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'decision_date', label: 'Decision date', type: 'text', optional: true },
    ],
    nested: { key: 'options', label: 'Options', columns: [{ key: 'option', label: 'Option' }, { key: 'selected', label: 'Selected' }] },
  },
  opportunities: {
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', optional: true },
      { key: 'score', label: 'Score (0–1)', type: 'number', min: 0, max: 1, step: 0.1, optional: true },
      { key: 'owner', label: 'Owner', type: 'text', optional: true },
    ],
  },
}

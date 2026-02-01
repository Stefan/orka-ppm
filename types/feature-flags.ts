/**
 * Feature Toggle System: types for global and org-scoped flags.
 * Design: .kiro/specs/feature-toggle-system/design.md
 */

export interface FeatureFlag {
  id: string
  name: string
  enabled: boolean
  organization_id: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface FeatureFlagCreate {
  name: string
  enabled: boolean
  organization_id?: string | null
  description?: string
}

export interface FeatureFlagUpdate {
  enabled?: boolean
  organization_id?: string | null
  description?: string
}

export interface FeatureFlagsContextValue {
  flags: Map<string, boolean>
  loading: boolean
  error: Error | null
  isFeatureEnabled: (flagName: string) => boolean
  refreshFlags: () => Promise<void>
}

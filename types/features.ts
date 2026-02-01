/**
 * Features Overview: types for hierarchical feature catalog
 */

export interface Feature {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  screenshot_url: string | null
  link: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

export interface FeatureTreeNode {
  id: string
  name: string
  parentId: string | null
  description: string | null
  screenshot_url: string | null
  link: string | null
  icon: string | null
  children: FeatureTreeNode[]
  /** Original feature for detail card */
  feature: Feature
}

export interface FeatureSearchResult {
  feature: Feature
  score?: number
  matches?: string[]
}

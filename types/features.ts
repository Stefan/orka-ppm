/**
 * Features Overview: types for hierarchical feature catalog and crawled documentation
 */

/** Source of a documentation item (crawl) */
export type DocSource = 'route' | 'spec' | 'doc'

/** Item from project crawl (app routes, .kiro/specs, docs/) */
export interface DocItem {
  id: string
  name: string
  description: string | null
  link: string | null
  source: DocSource
  sourcePath: string
  parentId: string | null
  icon: string | null
}

/** Tree node for documentation (sections as roots, items as children) */
export interface DocTreeNode {
  id: string
  name: string
  description: string | null
  link: string | null
  source: DocSource
  sourcePath: string
  icon: string | null
  children: DocTreeNode[]
  item: DocItem
}

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

/** Single tree: roots = app pages, children = sub-features (from catalog). */
export interface PageOrFeatureNode {
  id: string
  name: string
  link: string | null
  description: string | null
  screenshot_url: string | null
  icon: string | null
  children: PageOrFeatureNode[]
  /** Non-null for feature nodes; null for page (root) nodes. */
  feature: Feature | null
}

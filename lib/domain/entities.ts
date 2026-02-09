/**
 * Domain entities: Portfolio, Program, Project (hierarchy with ltree path).
 * Used by /admin/hierarchy and API clients.
 */

export type EntityType = 'portfolio' | 'program' | 'project'

export interface Portfolio {
  id: string
  name: string
  description?: string | null
  owner_id?: string | null
  organization_id?: string | null
  path?: string | null
  created_at?: string
  updated_at?: string
}

export interface Program {
  id: string
  portfolio_id: string
  name: string
  description?: string | null
  sort_order?: number
  path?: string | null
  created_at?: string
  updated_at?: string
  total_budget?: number
  total_actual_cost?: number
  project_count?: number
}

export interface Project {
  id: string
  portfolio_id: string
  program_id?: string | null
  name: string
  status?: string
  health?: string
  budget?: number
  actual_cost?: number
  start_date?: string | null
  end_date?: string | null
  path?: string | null
  created_at?: string
  updated_at?: string
}

/** Tree node for hierarchy UI (Portfolio → Program → Project) */
export interface HierarchyNode {
  id: string
  type: EntityType
  label: string
  entity: Portfolio | Program | Project
  parentId: string | null
  children: HierarchyNode[]
}

/** Build a flat list of nodes for tree rendering (parent-first, with depth) */
export function buildHierarchyNodes(
  portfolios: Portfolio[],
  programsByPortfolio: Record<string, Program[]>,
  projectsByPortfolio: Record<string, Project[]>
): HierarchyNode[] {
  const nodes: HierarchyNode[] = []
  for (const p of portfolios) {
    nodes.push({
      id: `portfolio-${p.id}`,
      type: 'portfolio',
      label: p.name,
      entity: p,
      parentId: null,
      children: [],
    })
    const programs = programsByPortfolio[p.id] ?? []
    for (const g of programs) {
      nodes.push({
        id: `program-${g.id}`,
        type: 'program',
        label: g.name,
        entity: g,
        parentId: `portfolio-${p.id}`,
        children: [],
      })
      const projects = (projectsByPortfolio[p.id] ?? []).filter(
        (j) => j.program_id === g.id
      )
      for (const j of projects) {
        nodes.push({
          id: `project-${j.id}`,
          type: 'project',
          label: j.name,
          entity: j,
          parentId: `program-${g.id}`,
          children: [],
        })
      }
    }
    const ungrouped = (projectsByPortfolio[p.id] ?? []).filter((j) => !j.program_id)
    for (const j of ungrouped) {
      nodes.push({
        id: `project-${j.id}`,
        type: 'project',
        label: j.name,
        entity: j,
        parentId: `portfolio-${p.id}`,
        children: [],
      })
    }
  }
  return nodes
}

/** Build nested tree (each node has children array) */
export function buildHierarchyTree(
  portfolios: Portfolio[],
  programsByPortfolio: Record<string, Program[]>,
  projectsByPortfolio: Record<string, Project[]>
): HierarchyNode[] {
  const flat = buildHierarchyNodes(portfolios, programsByPortfolio, projectsByPortfolio)
  const byId = new Map<string, HierarchyNode>()
  for (const n of flat) {
    byId.set(n.id, { ...n, children: [] })
  }
  const roots: HierarchyNode[] = []
  for (const n of flat) {
    const node = byId.get(n.id)!
    if (n.parentId === null) {
      roots.push(node)
    } else {
      const parent = byId.get(n.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }
  return roots
}

/** Sync API response types */
export interface MatchSuggestion {
  project_id: string
  project_name?: string
  score: number
  reason?: string
}

export interface SyncResult {
  created: { id: string; name: string }[]
  matched: MatchSuggestion[]
  errors?: string[]
}

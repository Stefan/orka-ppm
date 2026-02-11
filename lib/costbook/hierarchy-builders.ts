// Costbook Hierarchy Builders
// Builds CES and WBS hierarchies from commitments

import { Commitment, HierarchyNode, Currency } from '@/types/costbook'
import { roundToDecimal } from '../costbook-calculations'

/**
 * Builds a CES (Cost Element Structure) hierarchy from commitments.
 * Structure: Project → Cost category → Vendor (so vendors are grouped by project and category, not one flat list).
 * @param projectNames optional map project_id → project name for root labels
 */
export function buildCESHierarchy(
  commitments: Commitment[],
  currency: Currency,
  projectNames?: Record<string, string>
): HierarchyNode[] {
  // Level 0: Project, Level 1: Category (cost element), Level 2: Vendor
  const projectNodes: Map<string, HierarchyNode> = new Map()

  commitments.forEach(commitment => {
    const projectId = commitment.project_id || 'unknown'
    const projectLabel = projectNames?.[projectId] ?? projectId

    if (!projectNodes.has(projectId)) {
      projectNodes.set(projectId, {
        id: `ces-project-${projectId}`,
        name: projectLabel,
        level: 0,
        total_budget: 0,
        total_spend: 0,
        variance: 0,
        children: []
      })
    }
    const projectNode = projectNodes.get(projectId)!
    projectNode.total_spend += commitment.amount

    const category = extractCategory(commitment.description) || 'General'
    let categoryNode = projectNode.children.find(c => c.name === category)
    if (!categoryNode) {
      categoryNode = {
        id: `ces-${projectId}-${category.toLowerCase().replace(/\s+/g, '-')}`,
        name: category,
        level: 1,
        parent_id: projectNode.id,
        total_budget: 0,
        total_spend: 0,
        variance: 0,
        children: []
      }
      projectNode.children.push(categoryNode)
    }
    categoryNode.total_spend += commitment.amount

    let vendorNode = categoryNode.children.find(c => c.name === commitment.vendor_name)
    if (!vendorNode) {
      vendorNode = {
        id: `ces-${projectId}-${category.toLowerCase()}-${commitment.vendor_id}`,
        name: commitment.vendor_name,
        level: 2,
        parent_id: categoryNode.id,
        total_budget: 0,
        total_spend: 0,
        variance: 0,
        children: []
      }
      categoryNode.children.push(vendorNode)
    }
    vendorNode.total_spend += commitment.amount
  })

  const result = Array.from(projectNodes.values())
  result.forEach(calculateVariances)
  return result
}

/**
 * Builds a WBS (Work Breakdown Structure) hierarchy from commitments
 * Groups commitments by project phases
 */
export function buildWBSHierarchy(
  commitments: Commitment[],
  currency: Currency
): HierarchyNode[] {
  // Group by project phase (simulated from PO numbers)
  const phases: Map<string, HierarchyNode> = new Map()

  commitments.forEach(commitment => {
    const phase = extractPhase(commitment.po_number) || 'Phase 1'
    
    if (!phases.has(phase)) {
      phases.set(phase, {
        id: `wbs-${phase.toLowerCase().replace(/\s+/g, '-')}`,
        name: phase,
        level: 0,
        total_budget: 0,
        total_spend: 0,
        variance: 0,
        children: []
      })
    }

    const phaseNode = phases.get(phase)!
    phaseNode.total_spend += commitment.amount

    // Create work package node
    const workPackage = extractWorkPackage(commitment.description)
    let wpNode = phaseNode.children.find(c => c.name === workPackage)
    
    if (!wpNode) {
      wpNode = {
        id: `wbs-${phase.toLowerCase()}-${workPackage.toLowerCase().replace(/\s+/g, '-')}`,
        name: workPackage,
        level: 1,
        parent_id: phaseNode.id,
        total_budget: 0,
        total_spend: 0,
        variance: 0,
        children: []
      }
      phaseNode.children.push(wpNode)
    }

    wpNode.total_spend += commitment.amount

    // Create commitment node as leaf
    const commitmentNode: HierarchyNode = {
      id: commitment.id,
      name: commitment.description.substring(0, 50) + (commitment.description.length > 50 ? '...' : ''),
      level: 2,
      parent_id: wpNode.id,
      total_budget: 0,
      total_spend: commitment.amount,
      variance: -commitment.amount,
      children: []
    }
    wpNode.children.push(commitmentNode)
  })

  // Calculate variances
  const result = Array.from(phases.values())
  result.forEach(calculateVariances)

  return result
}

/**
 * Recursively calculates variances for a hierarchy node
 */
function calculateVariances(node: HierarchyNode): void {
  // Calculate children first
  node.children.forEach(calculateVariances)

  // If no budget set, estimate from children
  if (node.total_budget === 0 && node.children.length > 0) {
    node.total_budget = node.children.reduce((sum, c) => sum + c.total_budget, 0)
  }

  // If still no budget, estimate 20% higher than spend
  if (node.total_budget === 0) {
    node.total_budget = roundToDecimal(node.total_spend * 1.2)
  }

  // Calculate variance
  node.variance = roundToDecimal(node.total_budget - node.total_spend)
}

/**
 * Extracts category from commitment description
 */
function extractCategory(description: string): string {
  const categories = ['Design', 'Development', 'Testing', 'Infrastructure', 'Consulting', 'Hardware', 'Software']
  const lowerDesc = description.toLowerCase()
  
  for (const category of categories) {
    if (lowerDesc.includes(category.toLowerCase())) {
      return category
    }
  }
  
  return 'General'
}

/**
 * Extracts phase from PO number
 */
function extractPhase(poNumber: string): string {
  // Extract phase from PO number format (e.g., "PO-2024-001" -> Phase 1)
  const match = poNumber.match(/(\d+)$/)
  if (match) {
    const num = parseInt(match[1], 10)
    if (num <= 50) return 'Phase 1'
    if (num <= 100) return 'Phase 2'
    return 'Phase 3'
  }
  return 'Phase 1'
}

/**
 * Extracts work package from description
 */
function extractWorkPackage(description: string): string {
  const workPackages = [
    'Requirements',
    'Design',
    'Development',
    'Testing',
    'Deployment',
    'Training',
    'Support'
  ]
  
  const lowerDesc = description.toLowerCase()
  
  for (const wp of workPackages) {
    if (lowerDesc.includes(wp.toLowerCase())) {
      return wp
    }
  }
  
  return 'General Work'
}

/**
 * Flattens a hierarchy tree for table display
 */
export function flattenHierarchy(
  nodes: HierarchyNode[],
  result: Array<HierarchyNode & { depth: number }> = [],
  depth: number = 0
): Array<HierarchyNode & { depth: number }> {
  nodes.forEach(node => {
    result.push({ ...node, depth })
    if (node.children.length > 0) {
      flattenHierarchy(node.children, result, depth + 1)
    }
  })
  return result
}

/**
 * Calculates total for a hierarchy
 */
export function calculateHierarchyTotals(nodes: HierarchyNode[]): {
  totalBudget: number
  totalSpend: number
  totalVariance: number
} {
  let totalBudget = 0
  let totalSpend = 0

  nodes.forEach(node => {
    totalBudget += node.total_budget
    totalSpend += node.total_spend
  })

  return {
    totalBudget: roundToDecimal(totalBudget),
    totalSpend: roundToDecimal(totalSpend),
    totalVariance: roundToDecimal(totalBudget - totalSpend)
  }
}

/**
 * Finds a node by ID in the hierarchy
 */
export function findNodeById(
  nodes: HierarchyNode[],
  id: string
): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * Gets the path from root to a node
 */
export function getNodePath(
  nodes: HierarchyNode[],
  id: string,
  path: string[] = []
): string[] | null {
  for (const node of nodes) {
    const currentPath = [...path, node.name]
    
    if (node.id === id) {
      return currentPath
    }
    
    if (node.children.length > 0) {
      const found = getNodePath(node.children, id, currentPath)
      if (found) return found
    }
  }
  return null
}
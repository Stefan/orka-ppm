/**
 * Build hierarchical feature tree from flat list
 */
import type { Feature, FeatureTreeNode } from '@/types/features'

export function buildFeatureTree(features: Feature[]): FeatureTreeNode[] {
  const byId = new Map<string, Feature>()
  features.forEach((f) => byId.set(f.id, f))

  const roots: FeatureTreeNode[] = []

  function makeNode(feature: Feature): FeatureTreeNode {
    const children = features
      .filter((c) => c.parent_id === feature.id)
      .map((c) => makeNode(c))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      id: feature.id,
      name: feature.name,
      parentId: feature.parent_id,
      description: feature.description,
      screenshot_url: feature.screenshot_url,
      link: feature.link,
      icon: feature.icon,
      children,
      feature,
    }
  }

  features
    .filter((f) => f.parent_id == null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((f) => roots.push(makeNode(f)))

  return roots
}

export function flattenTree(nodes: FeatureTreeNode[]): Feature[] {
  const out: Feature[] = []
  function visit(n: FeatureTreeNode) {
    out.push(n.feature)
    n.children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

export function findNodeById(
  nodes: FeatureTreeNode[],
  id: string
): FeatureTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}

/**
 * Build a single tree: roots = app pages (from routes), children = sub-features from catalog.
 * Used by Features Overview so there is only one tree driven by app pages.
 */
import type { DocItem } from '@/types/features'
import type { Feature, FeatureTreeNode, PageOrFeatureNode } from '@/types/features'
import { buildFeatureTree } from './tree'

/**
 * Check if a feature belongs as a CHILD of a page.
 * Features with the exact same link as the page are NOT children (redundant).
 * Only sub-pages (like /financials?tab=x or /financials/sub) are children.
 */
function linkBelongsToPage(featureLink: string | null, pageLink: string): boolean {
  if (!featureLink) return false
  if (pageLink === '/') return false // Root page has no feature children by link
  // Do NOT match exact link (that's the page itself, not a child)
  // Only match sub-paths or query params
  return featureLink.startsWith(pageLink + '?') || featureLink.startsWith(pageLink + '/')
}

function featureTreeNodeToPageOrFeature(node: FeatureTreeNode): PageOrFeatureNode {
  return {
    id: node.id,
    name: node.name,
    link: node.link,
    description: node.description,
    screenshot_url: node.screenshot_url,
    icon: node.icon,
    children: node.children.map(featureTreeNodeToPageOrFeature),
    feature: node.feature,
  }
}

/**
 * Build one tree: roots = app pages (from routes), under each page = sub-features from catalog.
 * Respects parentId hierarchy so sub-routes (like /financials?tab=costbook) appear under their parent.
 * Features are assigned to a page when feature.link matches the page path (or starts with page? or page/).
 */
export function buildPageTree(routes: DocItem[], features: Feature[]): PageOrFeatureNode[] {
  const routeItems = routes.filter((r) => r.source === 'route' && r.id.startsWith('route:'))

  // Build a map of route ID -> route for quick lookup
  const routeMap = new Map<string, DocItem>()
  routeItems.forEach((r) => routeMap.set(r.id, r))

  // Find top-level routes (parentId is section:routes or not a route)
  const topLevelRoutes = routeItems.filter(
    (r) => !r.parentId || r.parentId === 'section:routes' || !r.parentId.startsWith('route:')
  )

  // Find child routes for a given parent
  const getChildRoutes = (parentId: string): DocItem[] =>
    routeItems.filter((r) => r.parentId === parentId)

  // Convert a route to a PageOrFeatureNode, recursively including child routes
  const routeToNode = (route: DocItem): PageOrFeatureNode => {
    const pageFeatures = features.filter((f) => linkBelongsToPage(f.link, route.link || ''))
    const featureTree = buildFeatureTree(pageFeatures)
    const featureChildren = featureTree.map(featureTreeNodeToPageOrFeature)

    // Get child routes (sub-pages like tabs)
    const childRoutes = getChildRoutes(route.id)
    const routeChildren = childRoutes.map(routeToNode)

    // Combine feature children and route children
    const allChildren = [...routeChildren, ...featureChildren]

    return {
      id: route.id,
      name: route.name,
      link: route.link,
      description: route.description ?? null,
      screenshot_url: route.screenshot_url ?? null,
      icon: route.icon,
      children: allChildren,
      feature: null,
    } as PageOrFeatureNode
  }

  const sorted = topLevelRoutes.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return sorted.map(routeToNode)
}

export function findPageOrFeatureNode(
  nodes: PageOrFeatureNode[],
  id: string
): PageOrFeatureNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findPageOrFeatureNode(node.children, id)
    if (found) return found
  }
  return null
}

export function flattenPageTree(nodes: PageOrFeatureNode[]): PageOrFeatureNode[] {
  const out: PageOrFeatureNode[] = []
  function visit(n: PageOrFeatureNode) {
    out.push(n)
    n.children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

/**
 * Build a single tree: roots = app pages (from routes), children = sub-features from catalog.
 * Used by Features Overview so there is only one tree driven by app pages.
 */
import type { DocItem } from '@/types/features'
import type { Feature, FeatureTreeNode, PageOrFeatureNode } from '@/types/features'
import { buildFeatureTree } from './tree'

function linkBelongsToPage(featureLink: string | null, pageLink: string): boolean {
  if (!featureLink) return false
  if (pageLink === '/') return featureLink === '/'
  return (
    featureLink === pageLink ||
    featureLink.startsWith(pageLink + '?') ||
    featureLink.startsWith(pageLink + '/')
  )
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
 * Features are assigned to a page when feature.link matches the page path (or starts with page? or page/).
 */
export function buildPageTree(routes: DocItem[], features: Feature[]): PageOrFeatureNode[] {
  const routeItems = routes.filter((r) => r.source === 'route' && r.id.startsWith('route:'))
  const sorted = routeItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  // #region agent log
  const firstRoute = sorted[0]
  if (typeof fetch !== 'undefined' && firstRoute) {
    fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'lib/features/page-tree.ts:buildPageTree',
        message: 'buildPageTree route.description preserved',
        data: {
          firstRouteId: firstRoute.id,
          routeDescLen: firstRoute.description?.length ?? 0,
          nodeDescLen: firstRoute.description?.length ?? 0,
          runId: 'post-fix',
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H3',
      }),
    }).catch(() => {})
  }
  // #endregion
  return sorted.map((route) => {
    const pageFeatures = features.filter((f) => linkBelongsToPage(f.link, route.link || ''))
    const childTree = buildFeatureTree(pageFeatures)
    const children = childTree.map(featureTreeNodeToPageOrFeature)
    return {
      id: route.id,
      name: route.name,
      link: route.link,
      description: route.description ?? null,
      screenshot_url: null,
      icon: route.icon,
      children,
      feature: null,
    } as PageOrFeatureNode
  })
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

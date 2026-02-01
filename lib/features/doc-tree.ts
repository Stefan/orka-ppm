/**
 * Build documentation tree from flat DocItem list.
 * buildDocTree: sections as roots, items as children.
 * buildCategorizedDocTree: sections → categories → items (tree structure by category).
 */
import type { DocItem, DocTreeNode } from '@/types/features'

/** Category label from spec id (e.g. spec:ai-help-chat → "AI"). Exported for use in Discovered tree. */
export function getSpecCategory(id: string): string {
  const after = id.replace(/^spec:/, '')
  const segment = after.split('-')[0] ?? after
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

/** Category label from doc sourcePath (e.g. docs/frontend/x.md → "Frontend", docs/x.md → "General") */
function docCategory(sourcePath: string): string {
  const parts = sourcePath.replace(/^docs\/?/, '').split('/').filter(Boolean)
  if (parts.length <= 1) return 'General'
  const segment = parts[0] ?? 'General'
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export function buildDocTree(items: DocItem[]): DocTreeNode[] {
  const byId = new Map<string, DocItem>()
  items.forEach((item) => byId.set(item.id, item))

  const sectionIds = items.filter((i) => i.id.startsWith('section:')).map((i) => i.id)
  const roots: DocTreeNode[] = []

  function makeNode(item: DocItem): DocTreeNode {
    const children = items
      .filter((c) => c.parentId === item.id)
      .map((c) => makeNode(c))
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      link: item.link,
      source: item.source,
      sourcePath: item.sourcePath,
      icon: item.icon,
      children,
      item,
    }
  }

  sectionIds.forEach((id) => {
    const item = byId.get(id)
    if (item) roots.push(makeNode(item))
  })

  return roots.sort((a, b) => a.name.localeCompare(b.name))
}

/** Synthetic DocItem for a category node */
function categoryItem(
  id: string,
  name: string,
  source: DocItem['source']
): DocItem {
  return {
    id,
    name,
    description: null,
    link: null,
    source,
    sourcePath: '',
    parentId: null,
    icon: 'FileText',
  }
}

/**
 * Build a categorized tree: Section → Category → Items.
 * Specs grouped by first segment of id (e.g. ai-help-chat → AI).
 * Docs grouped by first folder in path (e.g. docs/frontend/ → Frontend, docs/x.md → General).
 */
export function buildCategorizedDocTree(items: DocItem[]): DocTreeNode[] {
  const sectionSpecs = items.find((i) => i.id === 'section:specs')
  const sectionDocs = items.find((i) => i.id === 'section:docs')
  const specs = items.filter((i) => i.source === 'spec' && !i.id.startsWith('section:'))
  const docs = items.filter((i) => i.source === 'doc' && !i.id.startsWith('section:'))

  const roots: DocTreeNode[] = []

  if (sectionSpecs && specs.length > 0) {
    const byCategory = new Map<string, DocItem[]>()
    for (const s of specs) {
      const cat = getSpecCategory(s.id)
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(s)
    }
    const categoryNodes: DocTreeNode[] = []
    for (const [cat, catSpecs] of Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const catId = `cat:specs:${cat.toLowerCase()}`
      const item = categoryItem(catId, cat, 'spec')
      const children = catSpecs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ ...d, children: [], item: d }))
      categoryNodes.push({ ...item, children, item })
    }
    roots.push({
      ...sectionSpecs,
      children: categoryNodes,
      item: sectionSpecs,
    })
  }

  if (sectionDocs && docs.length > 0) {
    const byCategory = new Map<string, DocItem[]>()
    for (const d of docs) {
      const cat = docCategory(d.sourcePath)
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(d)
    }
    const categoryNodes: DocTreeNode[] = []
    for (const [cat, catDocs] of Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const catId = `cat:docs:${cat.toLowerCase().replace(/\s+/g, '-')}`
      const item = categoryItem(catId, cat, 'doc')
      const children = catDocs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ ...d, children: [], item: d }))
      categoryNodes.push({ ...item, children, item })
    }
    roots.push({
      ...sectionDocs,
      children: categoryNodes,
      item: sectionDocs,
    })
  }

  return roots.sort((a, b) => a.name.localeCompare(b.name))
}

export function findDocNodeById(nodes: DocTreeNode[], id: string): DocTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findDocNodeById(node.children, id)
    if (found) return found
  }
  return null
}

export function flattenDocTree(nodes: DocTreeNode[]): DocItem[] {
  const out: DocItem[] = []
  function visit(n: DocTreeNode) {
    out.push(n.item)
    n.children.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

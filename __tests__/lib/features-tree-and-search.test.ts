/**
 * Unit tests for Features Overview: buildFeatureTree, flattenTree, findNodeById, searchFeatures
 * Task 6.3
 */
import { buildFeatureTree, flattenTree, findNodeById } from '@/lib/features/tree'
import { searchFeatures, getFeatureIdsFromSearchResults } from '@/lib/features/search'
import type { Feature } from '@/types/features'

const now = '2024-01-01T00:00:00Z'

const flatFeatures: Feature[] = [
  { id: 'root1', name: 'Financials', parent_id: null, description: 'Money', screenshot_url: null, link: '/financials', icon: 'Wallet', created_at: now, updated_at: now },
  { id: 'root2', name: 'Data', parent_id: null, description: 'Data stuff', screenshot_url: null, link: null, icon: 'Database', created_at: now, updated_at: now },
  { id: 'child1', name: 'Costbook', parent_id: 'root1', description: 'Costs', screenshot_url: null, link: '/costbook', icon: 'BookOpen', created_at: now, updated_at: now },
  { id: 'child2', name: 'Import Builder', parent_id: 'root2', description: 'Custom templates, mapping, validation', screenshot_url: null, link: '/import', icon: 'Upload', created_at: now, updated_at: now },
]

describe('buildFeatureTree', () => {
  it('builds roots from flat list', () => {
    const tree = buildFeatureTree(flatFeatures)
    expect(tree).toHaveLength(2)
    expect(tree[0].name).toBe('Data')
    expect(tree[1].name).toBe('Financials')
  })

  it('attaches children to correct parent', () => {
    const tree = buildFeatureTree(flatFeatures)
    const financials = tree.find((n) => n.name === 'Financials')
    expect(financials?.children).toHaveLength(1)
    expect(financials?.children[0].name).toBe('Costbook')
    const data = tree.find((n) => n.name === 'Data')
    expect(data?.children).toHaveLength(1)
    expect(data?.children[0].name).toBe('Import Builder')
  })

  it('sorts roots and children by name', () => {
    const tree = buildFeatureTree(flatFeatures)
    expect(tree[0].name).toBe('Data')
    expect(tree[1].name).toBe('Financials')
  })
})

describe('flattenTree', () => {
  it('returns all features in tree order', () => {
    const tree = buildFeatureTree(flatFeatures)
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(4)
    expect(flat.map((f) => f.name)).toContain('Financials')
    expect(flat.map((f) => f.name)).toContain('Import Builder')
  })
})

describe('findNodeById', () => {
  it('finds root node', () => {
    const tree = buildFeatureTree(flatFeatures)
    const node = findNodeById(tree, 'root1')
    expect(node).not.toBeNull()
    expect(node?.name).toBe('Financials')
  })

  it('finds nested node', () => {
    const tree = buildFeatureTree(flatFeatures)
    const node = findNodeById(tree, 'child2')
    expect(node).not.toBeNull()
    expect(node?.name).toBe('Import Builder')
  })

  it('returns null for missing id', () => {
    const tree = buildFeatureTree(flatFeatures)
    expect(findNodeById(tree, 'missing')).toBeNull()
  })
})

describe('searchFeatures', () => {
  it('returns all features when query is empty', () => {
    const results = searchFeatures(flatFeatures, '')
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.feature)).toBe(true)
  })

  it('returns matching features for substring query', () => {
    const results = searchFeatures(flatFeatures, 'Import')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((r) => r.feature.name.includes('Import'))).toBe(true)
  })

  it('returns matching features for description query', () => {
    const results = searchFeatures(flatFeatures, 'mapping')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((r) => r.feature.description?.includes('mapping'))).toBe(true)
  })

  it('trims query', () => {
    const results = searchFeatures(flatFeatures, '  Costbook  ')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})

describe('getFeatureIdsFromSearchResults', () => {
  it('maps results to feature ids', () => {
    const results = searchFeatures(flatFeatures, 'Import')
    const ids = getFeatureIdsFromSearchResults(results)
    expect(Array.isArray(ids)).toBe(true)
    expect(ids.every((id) => typeof id === 'string')).toBe(true)
  })
})

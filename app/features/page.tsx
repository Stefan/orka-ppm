'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/components/shared/AppLayout'
import {
  FeatureDetailCard,
  FeatureSearchBar,
  PageDetailCard,
  VirtualizedPageFeatureTree,
  FeatureHoverPreview,
  InlineEditFeatureModal,
} from '@/components/features'
import { buildPageTree, findPageOrFeatureNode, flattenPageTree, searchFeatures } from '@/lib/features'
import { supabase } from '@/lib/api/supabase'
import type { Feature, FeatureSearchResult, PageOrFeatureNode } from '@/types/features'
import { Layers } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

const STALE_TIME_MS = 5 * 60 * 1000 // 5 min

const DEFAULT_FEATURES: Feature[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Financials',
    parent_id: null,
    description: 'Budget, commitments, actuals, and variance tracking.',
    screenshot_url: null,
    link: '/financials',
    icon: 'Wallet',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Data',
    parent_id: null,
    description: 'Data import, export, and integration.',
    screenshot_url: null,
    link: '/import',
    icon: 'Database',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Costbook',
    parent_id: 'a0000000-0000-0000-0000-000000000001',
    description: 'Costbook view: projects grid, commitments, actuals, KPIs.',
    screenshot_url: null,
    link: '/financials?tab=costbook',
    icon: 'BookOpen',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'EAC Calculation',
    parent_id: 'b0000000-0000-0000-0000-000000000001',
    description: 'Estimate at Completion and variance analysis.',
    screenshot_url: null,
    link: '/financials?tab=costbook',
    icon: 'Calculator',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Import Builder',
    parent_id: 'a0000000-0000-0000-0000-000000000002',
    description:
      'Custom templates, mapping, sections, and validation. 10x: AI auto-mapping, live preview, error-fix suggestions.',
    screenshot_url: null,
    link: '/import',
    icon: 'Upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

async function fetchFeatureCatalog(): Promise<Feature[]> {
  const { data, error } = await supabase
    .from('feature_catalog')
    .select('*')
    .order('name')
  if (error || !data || data.length === 0) return DEFAULT_FEATURES
  return data as Feature[]
}

async function fetchFeaturesDocs(): Promise<{ routes: unknown[] }> {
  const res = await fetch('/api/features/docs')
  if (!res.ok) throw new Error('Failed to load docs')
  const json = await res.json()
  return { routes: Array.isArray(json.routes) ? json.routes : [] }
}

function collectAncestorIds(
  nodes: PageOrFeatureNode[],
  targetId: string,
  path: Set<string> = new Set()
): Set<string> | null {
  for (const node of nodes) {
    if (node.id === targetId) return new Set(path)
    path.add(node.id)
    const found = collectAncestorIds(node.children, targetId, path)
    if (found) return found
    path.delete(node.id)
  }
  return null
}

function FeaturesContent() {
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const [treeHeight, setTreeHeight] = useState(400)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [searchResults, setSearchResults] = useState<FeatureSearchResult[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [hoveredNode, setHoveredNode] = useState<PageOrFeatureNode | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)

  const featuresQuery = useQuery({
    queryKey: ['features', 'catalog'],
    queryFn: fetchFeatureCatalog,
    staleTime: STALE_TIME_MS,
    placeholderData: DEFAULT_FEATURES,
  })

  const docsQuery = useQuery({
    queryKey: ['features', 'docs'],
    queryFn: fetchFeaturesDocs,
    staleTime: STALE_TIME_MS,
    placeholderData: { routes: [] },
  })

  const features = featuresQuery.data ?? DEFAULT_FEATURES
  const routes = (docsQuery.data?.routes ?? []) as { id: string; name: string; description?: string | null; link?: string | null; source?: string; sourcePath?: string; parentId?: string | null; icon?: string | null; screenshot_url?: string | null }[]

  useEffect(() => {
    const el = treeContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { height } = entries[0]?.contentRect ?? {}
      if (typeof height === 'number' && height > 0) setTreeHeight(height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    let cancelled = false
    searchFeatures(features, searchQuery).then((results) => {
      if (!cancelled) setSearchResults(results)
    })
    return () => {
      cancelled = true
    }
  }, [features, searchQuery])

  const pageTree = useMemo(() => buildPageTree(routes as import('@/types/features').DocItem[], features), [routes, features])
  const flatNodes = useMemo(() => flattenPageTree(pageTree), [pageTree])

  useEffect(() => {
    if (pageTree.length === 0) return
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev
      return new Set(pageTree.map((n) => n.id))
    })
  }, [pageTree])
  const highlightIds = useMemo(() => {
    const ids = new Set<string>()
    searchResults.forEach((r) => ids.add(r.feature.id))
    flatNodes.forEach((n) => {
      if (n.feature && ids.has(n.feature.id)) ids.add(n.id)
      if (searchQuery.trim() && n.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) ids.add(n.id)
    })
    return ids
  }, [searchResults, flatNodes, searchQuery])

  useEffect(() => {
    if (highlightIds.size === 0) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of highlightIds) {
        const found = collectAncestorIds(pageTree, id)
        if (found) found.forEach((a) => next.add(a))
      }
      return next
    })
  }, [highlightIds, pageTree])

  const selectedNode = useMemo(
    () => (selectedId ? findPageOrFeatureNode(pageTree, selectedId) ?? null : null),
    [pageTree, selectedId]
  )
  const selectedFeature = selectedNode?.feature ?? null

  const handleSelect = useCallback((node: PageOrFeatureNode) => {
    setSelectedId(node.id)
  }, [])

  const handleAISuggest = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/features/search?q=${encodeURIComponent(query)}&rag=1`)
      if (!res.ok) return
      const json = await res.json()
      const ids = json.ids as string[] | undefined
      if (ids && ids.length > 0) {
        setSelectedId(ids[0])
        setExpandedIds((prev) => {
          const next = new Set(prev)
          const found = collectAncestorIds(pageTree, ids[0])
          if (found) found.forEach((a) => next.add(a))
          return next
        })
        setSearchQuery('')
      }
    } catch {
      // Ignore
    }
  }, [pageTree])

  const handleExplain = useCallback((feature: Feature) => {
    if (typeof window !== 'undefined' && (window as unknown as { openHelpChat?: (msg: string) => void }).openHelpChat) {
      (window as unknown as { openHelpChat: (msg: string) => void }).openHelpChat(`Explain: ${feature.name}`)
    } else {
      window.alert(`Feature: ${feature.name}\n\n${feature.description ?? 'No description.'}`)
    }
  }, [])

  const handleHoverNode = useCallback((node: PageOrFeatureNode | null, rect: DOMRect | null) => {
    setHoveredNode(node)
    setAnchorRect(rect)
  }, [])

  const handleEdit = useCallback((feature: Feature) => {
    setEditingFeature(feature)
    setEditModalOpen(true)
  }, [])

  const handleEditSaved = useCallback((updated: Feature) => {
    featuresQuery.refetch()
    setEditingFeature(null)
    setEditModalOpen(false)
    if (selectedId === updated.id) setSelectedId(updated.id)
  }, [featuresQuery, selectedId])

  const isLoading = featuresQuery.isLoading || docsQuery.isLoading

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="features-loading">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="features-page">
      <header
        className="flex-shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Features</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">By page · descriptions and screenshots</p>
            </div>
          </div>
          <div className="flex-1 min-w-0 max-w-xl">
            <FeatureSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onAISuggest={handleAISuggest}
              placeholder="Search features…"
            />
          </div>
          <button
            type="button"
            className="lg:hidden rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600"
            onClick={() => setTreeOpen((o) => !o)}
            aria-expanded={treeOpen}
          >
            {treeOpen ? 'Hide tree' : 'Show tree'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`
            flex-shrink-0 w-80 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex flex-col
            lg:block
            ${treeOpen ? 'block' : 'hidden'}
          `}
          data-testid="features-tree-sidebar"
        >
          <div ref={treeContainerRef} className="flex-1 min-h-0 p-3">
            <VirtualizedPageFeatureTree
              nodes={pageTree}
              selectedId={selectedId}
              onSelect={handleSelect}
              highlightIds={highlightIds}
              expandedIds={expandedIds}
              onExpandedIdsChange={setExpandedIds}
              onHoverNode={handleHoverNode}
              height={treeHeight}
            />
          </div>
        </aside>

        <FeatureHoverPreview
          node={hoveredNode}
          anchorRect={anchorRect ? { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height } : null}
          onClose={() => { setHoveredNode(null); setAnchorRect(null) }}
        />

        <main
          className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 bg-white dark:bg-slate-900"
          data-testid="features-detail-main"
        >
          {selectedNode?.feature ? (
            <FeatureDetailCard
              feature={selectedFeature!}
              onExplain={handleExplain}
              onEdit={handleEdit}
            />
          ) : (
            <PageDetailCard node={selectedNode} />
          )}
        </main>
      </div>

      {editingFeature && (
        <InlineEditFeatureModal
          feature={editingFeature}
          open={editModalOpen}
          onClose={() => { setEditModalOpen(false); setEditingFeature(null) }}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  )
}

export default function FeaturesPage() {
  return (
    <AppLayout>
      <div className="h-full min-h-[70vh] grid grid-rows-[auto_1fr] overflow-hidden" data-testid="features-overview-layout">
        <React.Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
          <FeaturesContent />
        </React.Suspense>
      </div>
    </AppLayout>
  )
}

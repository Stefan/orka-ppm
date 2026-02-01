'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/shared/AppLayout'
import { PageFeatureTree, FeatureDetailCard, FeatureSearchBar, PageDetailCard } from '@/components/features'
import { buildPageTree, findPageOrFeatureNode, flattenPageTree, searchFeatures } from '@/lib/features'
import { supabase } from '@/lib/api/supabase'
import type { Feature, FeatureSearchResult, PageOrFeatureNode, DocItem } from '@/types/features'
import { Layers } from 'lucide-react'

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

function FeaturesContent() {
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES)
  const [routes, setRoutes] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [routesLoading, setRoutesLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [searchResults, setSearchResults] = useState<FeatureSearchResult[]>([])

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

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('feature_catalog')
          .select('*')
          .order('name')

        if (!cancelled && !error && data && data.length > 0) {
          setFeatures(data as Feature[])
        }
      } catch {
        // Keep DEFAULT_FEATURES on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setRoutesLoading(true)
    fetch('/api/features/docs')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load docs'))))
      .then((json) => {
        // #region agent log
        const firstRoute = Array.isArray(json.routes) ? json.routes[0] : null
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'app/features/page.tsx:docs fetch',
            message: 'Client received docs response',
            data: {
              routesLen: json.routes?.length ?? 0,
              firstRouteId: firstRoute?.id,
              firstRouteDescLen: firstRoute?.description?.length ?? 0,
              hasFeatureDescriptionsKey: 'featureDescriptions' in json,
              featureDescriptionsCount: json.featureDescriptions ? Object.keys(json.featureDescriptions).length : 0,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: 'H3,H4,H5',
          }),
        }).catch(() => {})
        // #endregion
        if (!cancelled && Array.isArray(json.routes)) setRoutes(json.routes)
      })
      .catch(() => {
        if (!cancelled) setRoutes([])
      })
      .finally(() => {
        if (!cancelled) setRoutesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pageTree = useMemo(() => buildPageTree(routes, features), [routes, features])
  const flatNodes = useMemo(() => flattenPageTree(pageTree), [pageTree])
  const highlightIds = useMemo(() => {
    const ids = new Set<string>()
    searchResults.forEach((r) => ids.add(r.feature.id))
    flatNodes.forEach((n) => {
      if (n.feature && ids.has(n.feature.id)) ids.add(n.id)
      if (searchQuery.trim() && n.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) ids.add(n.id)
    })
    return ids
  }, [searchResults, flatNodes, searchQuery])

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
      const res = await fetch(`/api/features/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) return
      const json = await res.json()
      const ids = json.ids as string[] | undefined
      if (ids && ids.length > 0) {
        setSelectedId(ids[0])
        setSearchQuery('')
      }
    } catch {
      // Ignore
    }
  }, [])

  const handleExplain = useCallback((feature: Feature) => {
    if (typeof window !== 'undefined' && (window as unknown as { openHelpChat?: (msg: string) => void }).openHelpChat) {
      (window as unknown as { openHelpChat: (msg: string) => void }).openHelpChat(`Explain: ${feature.name}`)
    } else {
      window.alert(`Feature: ${feature.name}\n\n${feature.description ?? 'No description.'}`)
    }
  }, [])

  const isLoading = loading || routesLoading

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="features-loading">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="features-page">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Features</h1>
              <p className="text-xs text-gray-500">By page · descriptions and screenshots</p>
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
            className="lg:hidden rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
            flex-shrink-0 w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto
            lg:block
            ${treeOpen ? 'block' : 'hidden'}
          `}
          data-testid="features-tree-sidebar"
        >
          <div className="p-3">
            <PageFeatureTree
              nodes={pageTree}
              selectedId={selectedId}
              onSelect={handleSelect}
              highlightIds={highlightIds}
            />
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6" data-testid="features-detail-main">
          {selectedNode?.feature ? (
            <FeatureDetailCard feature={selectedFeature!} onExplain={handleExplain} />
          ) : (
            <PageDetailCard node={selectedNode} />
          )}
        </main>
      </div>
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

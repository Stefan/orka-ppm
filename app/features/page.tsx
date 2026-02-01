'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/shared/AppLayout'
import { FeatureTree, FeatureDetailCard, FeatureSearchBar } from '@/components/features'
import { buildFeatureTree, findNodeById, searchFeatures } from '@/lib/features'
import { supabase } from '@/lib/api/supabase'
import type { Feature, FeatureTreeNode } from '@/types/features'
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
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)

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

  const tree = useMemo(() => buildFeatureTree(features), [features])
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchFeatures(features, searchQuery) : []),
    [features, searchQuery]
  )
  const highlightIds = useMemo(
    () => new Set(searchResults.map((r) => r.feature.id)),
    [searchResults]
  )
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree
    const ids = highlightIds
    function keepNode(n: FeatureTreeNode): FeatureTreeNode | null {
      if (ids.has(n.id)) return n
      const keptChildren = n.children.map(keepNode).filter(Boolean) as FeatureTreeNode[]
      if (keptChildren.length > 0) {
        return { ...n, children: keptChildren }
      }
      return null
    }
    return tree.map(keepNode).filter(Boolean) as FeatureTreeNode[]
  }, [tree, searchQuery, highlightIds])

  const selectedFeature = useMemo(
    () => (selectedId ? features.find((f) => f.id === selectedId) ?? null : null),
    [features, selectedId]
  )

  const handleSelect = useCallback((node: FeatureTreeNode) => {
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
    // Optional: open help chat with context
    if (typeof window !== 'undefined' && (window as unknown as { openHelpChat?: (msg: string) => void }).openHelpChat) {
      (window as unknown as { openHelpChat: (msg: string) => void }).openHelpChat(`Explain: ${feature.name}`)
    } else {
      window.alert(`Feature: ${feature.name}\n\n${feature.description ?? 'No description.'}`)
    }
  }, [])

  if (loading) {
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
            <h1 className="text-lg font-semibold text-gray-900">Features</h1>
          </div>
          <div className="flex-1 min-w-0 max-w-xl">
            <FeatureSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onAISuggest={handleAISuggest}
              placeholder="Search features… (e.g. Import Builder)"
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
            <FeatureTree
              nodes={filteredTree}
              selectedId={selectedId}
              onSelect={handleSelect}
              highlightIds={highlightIds}
            />
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6" data-testid="features-detail-main">
          <FeatureDetailCard feature={selectedFeature} onExplain={handleExplain} />
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

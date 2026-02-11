'use client'

import { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'
import SubTabNavigation, { SubTabType } from './SubTabNavigation'
import VarianceAnalysisView from './views/VarianceAnalysisView'
import CommitmentsTable from './tables/CommitmentsTable'
import ActualsTable from './tables/ActualsTable'
import { SavedViewsDropdown } from '@/components/saved-views/SavedViewsDropdown'
import type { SavedViewDefinition } from '@/lib/saved-views-api'
import type { CommitmentsActualsSummary, CommitmentsActualsAnalytics } from '../hooks/useCommitmentsActualsData'

/** Lazy sub-tabs: mount a tab's content only when first visited, then keep mounted and hide with CSS. Avoids re-fetch and full re-render when switching back. */
function useVisitedSubTabs(initialTab: SubTabType) {
  const [visited, setVisited] = useState<Set<SubTabType>>(() => new Set([initialTab]))
  const addVisited = useCallback((tab: SubTabType) => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
  }, [])
  return [visited, addVisited] as const
}

interface CommitmentsActualsViewProps {
  session: any
  selectedCurrency: string
  onRefresh?: () => void
  commitmentsSummary?: CommitmentsActualsSummary | null
  commitmentsAnalytics?: CommitmentsActualsAnalytics | null
  commitmentsLoading?: boolean
  onRefreshCommitmentsActuals?: () => Promise<void>
}

// Define ref methods for child components
interface RefreshableComponent {
  refresh: () => void
}

export default function CommitmentsActualsView({
  session,
  selectedCurrency,
  onRefresh,
  commitmentsSummary,
  commitmentsAnalytics,
  commitmentsLoading,
  onRefreshCommitmentsActuals
}: CommitmentsActualsViewProps) {
  const t = useTranslations('financials')
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('variance-analysis')
  const [visitedSubTabs, addVisitedSubTab] = useVisitedSubTabs('variance-analysis')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [appliedView, setAppliedView] = useState<SavedViewDefinition | null>(null)
  const [appliedViewName, setAppliedViewName] = useState<string | null>(null)
  const [currentDefinition, setCurrentDefinition] = useState<SavedViewDefinition>({})

  const handleDefinitionChange = useCallback((def: SavedViewDefinition) => {
    setCurrentDefinition(def)
    setAppliedViewName(null) // user changed filters/sort manually; clear "applied view" label
  }, [])

  // Refs for child components
  const varianceAnalysisRef = useRef<RefreshableComponent>(null)
  const commitmentsTableRef = useRef<RefreshableComponent>(null)
  const actualsTableRef = useRef<RefreshableComponent>(null)

  const handleSubTabChange = useCallback((tab: SubTabType) => {
    setActiveSubTab(tab)
    addVisitedSubTab(tab)
  }, [addVisitedSubTab])

  const handleProjectClick = (projectNr: string) => {
    // Switch to variance analysis tab and filter by project
    setProjectFilter(projectNr)
    setActiveSubTab('variance-analysis')
  }

  const handleUnifiedRefresh = async () => {
    setIsRefreshing(true)
    
    try {
      // Trigger refresh on all child components
      const refreshPromises = []
      
      if (varianceAnalysisRef.current) {
        refreshPromises.push(varianceAnalysisRef.current.refresh())
      }
      if (commitmentsTableRef.current) {
        refreshPromises.push(commitmentsTableRef.current.refresh())
      }
      if (actualsTableRef.current) {
        refreshPromises.push(actualsTableRef.current.refresh())
      }
      
      await Promise.all(refreshPromises)
      onRefresh?.()
      await onRefreshCommitmentsActuals?.()
    } catch (error) {
      console.error('Error during unified refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SubTabNavigation
          activeTab={activeSubTab}
          onTabChange={handleSubTabChange}
        />
        <div className="flex items-center gap-2">
          <SavedViewsDropdown
            scope="financials"
            accessToken={session?.access_token}
            currentDefinition={currentDefinition}
            onApply={(def, view) => {
              setAppliedView(def)
              setAppliedViewName(view?.name ?? null)
            }}
            appliedViewName={appliedViewName}
            label={t('savedViews')}
          />
            <button
            onClick={handleUnifiedRefresh}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? t('refreshing') : t('refreshAll')}
          </button>
        </div>
      </div>

      {visitedSubTabs.has('variance-analysis') && (
        <div className={activeSubTab === 'variance-analysis' ? 'block' : 'hidden'}>
          <VarianceAnalysisView
            ref={varianceAnalysisRef}
            session={session}
            selectedCurrency={selectedCurrency}
            onRefresh={onRefresh}
            projectFilter={projectFilter}
            onClearProjectFilter={() => setProjectFilter('')}
          />
        </div>
      )}
      {visitedSubTabs.has('commitments') && (
        <div className={activeSubTab === 'commitments' ? 'block' : 'hidden'}>
          <CommitmentsTable
            ref={commitmentsTableRef}
            accessToken={session?.access_token}
            onProjectClick={handleProjectClick}
            initialView={appliedView}
            onDefinitionChange={handleDefinitionChange}
          />
        </div>
      )}
      {visitedSubTabs.has('actuals') && (
        <div className={activeSubTab === 'actuals' ? 'block' : 'hidden'}>
          <ActualsTable
            ref={actualsTableRef}
            accessToken={session?.access_token}
            onProjectClick={handleProjectClick}
            initialView={appliedView}
            onDefinitionChange={handleDefinitionChange}
          />
        </div>
      )}
    </div>
  )
}
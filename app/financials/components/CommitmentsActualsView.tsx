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

interface CommitmentsActualsViewProps {
  session: any
  selectedCurrency: string
  onRefresh?: () => void
}

// Define ref methods for child components
interface RefreshableComponent {
  refresh: () => void
}

export default function CommitmentsActualsView({ 
  session, 
  selectedCurrency, 
  onRefresh 
}: CommitmentsActualsViewProps) {
  const t = useTranslations('financials')
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('variance-analysis')
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
      
      // Also trigger parent refresh if provided
      onRefresh?.()
    } catch (error) {
      console.error('Error during unified refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'variance-analysis':
        return (
          <VarianceAnalysisView
            ref={varianceAnalysisRef}
            session={session}
            selectedCurrency={selectedCurrency}
            onRefresh={onRefresh}
            projectFilter={projectFilter}
            onClearProjectFilter={() => setProjectFilter('')}
          />
        )
      case 'commitments':
        return (
          <CommitmentsTable
            ref={commitmentsTableRef}
            accessToken={session?.access_token}
            onProjectClick={handleProjectClick}
            initialView={appliedView}
            onDefinitionChange={handleDefinitionChange}
          />
        )
      case 'actuals':
        return (
          <ActualsTable
            ref={actualsTableRef}
            accessToken={session?.access_token}
            onProjectClick={handleProjectClick}
            initialView={appliedView}
            onDefinitionChange={handleDefinitionChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SubTabNavigation 
          activeTab={activeSubTab} 
          onTabChange={setActiveSubTab} 
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
      
      {renderSubTabContent()}
    </div>
  )
}
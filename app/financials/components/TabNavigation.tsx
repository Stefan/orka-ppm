import React, { useMemo } from 'react'
import { 
  BarChart3, TrendingUp, PieChart, Target, Upload, FileText, 
  CheckCircle, FolderTree, BookOpen 
} from 'lucide-react'
import { ViewMode } from '../types'
import { useTranslations } from '../../../lib/i18n/context'
import { useFeatureFlag } from '../../../contexts/FeatureFlagContext'

interface TabConfig {
  key: ViewMode
  label: string
  icon: any
  description: string
  highlight?: boolean
}

interface TabNavigationProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

const TabButton = React.memo(({ tab, isActive, onClick }: { 
  tab: TabConfig, 
  isActive: boolean, 
  onClick: () => void 
}) => {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center px-4 py-3 rounded-lg font-medium text-sm transition-all duration-100
        ${isActive 
          ? 'bg-blue-600 text-white shadow-md' 
          : tab.highlight 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800' 
            : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700'
        }
      `}
      title={tab.description}
    >
      <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : tab.highlight ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}`} />
      <span className="whitespace-nowrap">{tab.label}</span>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-10">
        {tab.description}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-white rounded-full"></div>
      )}
    </button>
  )
})

TabButton.displayName = 'TabButton'

export default function TabNavigation({ viewMode, onViewModeChange }: TabNavigationProps) {
  const { t } = useTranslations()
  const { enabled: costbookEnabled } = useFeatureFlag('costbook_phase1')

  const tabConfig = useMemo((): TabConfig[] => {
    const tabs = [
      { key: 'overview', label: t('financials.tabs.overview'), icon: BarChart3, description: t('financials.descriptions.overview') },
      { key: 'detailed', label: t('financials.tabs.detailed'), icon: TrendingUp, description: t('financials.descriptions.detailed') },
      { key: 'trends', label: t('financials.tabs.trends'), icon: PieChart, description: t('financials.descriptions.trends') },
      { key: 'analysis', label: t('financials.tabs.analysis'), icon: Target, description: t('financials.descriptions.analysis') },
      { key: 'po-breakdown', label: t('financials.tabs.poBreakdown'), icon: FolderTree, description: t('financials.descriptions.poBreakdown') },
      { key: 'csv-import', label: t('financials.tabs.csvImport'), icon: Upload, description: t('financials.descriptions.csvImport') },
      { key: 'commitments-actuals', label: t('financials.tabs.commitmentsActuals'), icon: FileText, description: t('financials.descriptions.commitmentsActuals') }
    ]

    // Add costbook tab only if feature is enabled
    if (costbookEnabled) {
      tabs.splice(1, 0, { key: 'costbook', label: 'Budget & Cost Management', icon: BookOpen, description: 'Comprehensive budget tracking, cost management, and financial oversight with detailed project analysis', highlight: true })
    }

    return tabs
  }, [t, costbookEnabled])

  const currentViewLabel = useMemo(() => {
    switch (viewMode) {
      case 'overview': return t('financials.tabs.overview')
      case 'costbook': return 'Costbook'
      case 'detailed': return t('financials.tabs.detailed')
      case 'trends': return t('financials.tabs.trends')
      case 'analysis': return t('financials.tabs.analysis')
      case 'po-breakdown': return t('financials.tabs.poBreakdown')
      case 'csv-import': return t('financials.tabs.csvImport')
      case 'commitments-actuals': return t('financials.tabs.commitmentsActuals')
      default: return t('financials.tabs.overview')
    }
  }, [viewMode, t])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-1">
      <div className="flex flex-wrap gap-1">
        {tabConfig.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={viewMode === tab.key}
            onClick={() => onViewModeChange(tab.key)}
          />
        ))}
      </div>
      
      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-300">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
            {t('financials.currentView')}: <span className="font-medium ml-1">{currentViewLabel}</span>
          </div>
          {viewMode === 'csv-import' && (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <Upload className="h-3 w-3 mr-1" />
              <span className="text-xs">{t('financials.dragDropCSV')}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {viewMode === 'csv-import' && (
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-slate-400">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>{t('financials.supportedFormats')}</span>
            </div>
          )}
          <div className="text-xs text-gray-400 dark:text-slate-500">
            {t('financials.lastUpdated')}: {new Date().toLocaleTimeString('de-DE')}
          </div>
        </div>
      </div>
    </div>
  )
}
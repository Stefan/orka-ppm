import React, { useMemo, useRef, useEffect } from 'react'
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
        group relative flex items-center px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200
        ${isActive 
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50' 
          : 'text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-600 hover:border-blue-300 dark:hover:border-blue-500'
        }
      `}
    >
      <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-gray-700 dark:text-slate-300'}`} />
      <span className="whitespace-nowrap">{tab.label}</span>
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
      tabs.splice(1, 0, { key: 'costbook', label: 'Budget & Cost Management', icon: BookOpen, description: 'Comprehensive budget tracking, cost management, and financial oversight with detailed project analysis' })
    }

    return tabs
  }, [t, costbookEnabled])

  // #region agent log
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const log = () => {
      const pw = el.parentElement?.clientWidth
      const cw = el.clientWidth
      const sw = el.scrollWidth
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'TabNavigation.tsx:tabs', message: 'tab_row_metrics', data: { parentWidth: pw, clientWidth: cw, scrollWidth: sw, overflow: sw > cw }, hypothesisId: 'H1', timestamp: Date.now() }) }).catch(() => {})
    }
    log()
    const ro = new ResizeObserver(log)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tabConfig.length])
  // #endregion

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-3 min-w-0">
      <div ref={wrapRef} className="flex flex-wrap gap-2 overflow-x-auto min-w-0">
        {tabConfig.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={viewMode === tab.key}
            onClick={() => onViewModeChange(tab.key)}
          />
        ))}
      </div>
      
      {/* Context hints only when relevant (e.g. CSV import); no fake "last updated" (was just current time) */}
      {(viewMode === 'csv-import') && (
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300">
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Upload className="h-3 w-3 mr-1" />
            <span className="text-xs">{t('financials.dragDropCSV')}</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-slate-400">
            <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
            <span>{t('financials.supportedFormats')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
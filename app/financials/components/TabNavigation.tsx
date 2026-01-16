import React, { useMemo } from 'react'
import { 
  BarChart3, TrendingUp, PieChart, Target, Upload, FileText, 
  CheckCircle, FolderTree 
} from 'lucide-react'
import { ViewMode } from '../types'

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
            ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }
      `}
      title={tab.description}
    >
      <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : tab.highlight ? 'text-green-600' : 'text-gray-500'}`} />
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
  const tabConfig = useMemo((): TabConfig[] => [
    { key: 'overview', label: 'Übersicht', icon: BarChart3, description: 'Gesamtüberblick und KPIs' },
    { key: 'detailed', label: 'Detailliert', icon: TrendingUp, description: 'Detaillierte Kategorieanalyse' },
    { key: 'trends', label: 'Trends', icon: PieChart, description: 'Zeitliche Entwicklung und Prognosen' },
    { key: 'analysis', label: 'Analyse', icon: Target, description: 'Erweiterte Kostenanalyse' },
    { key: 'po-breakdown', label: 'PO Breakdown', icon: FolderTree, description: 'SAP Purchase Order Hierarchie' },
    { key: 'csv-import', label: 'CSV Import', icon: Upload, description: 'Daten importieren', highlight: true },
    { key: 'commitments-actuals', label: 'Commitments vs Actuals', icon: FileText, description: 'Geplant vs. Ist-Vergleich' }
  ], [])

  const currentViewLabel = useMemo(() => {
    switch (viewMode) {
      case 'overview': return 'Übersicht'
      case 'detailed': return 'Detailliert'
      case 'trends': return 'Trends'
      case 'analysis': return 'Analyse'
      case 'po-breakdown': return 'PO Breakdown'
      case 'csv-import': return 'CSV Import'
      case 'commitments-actuals': return 'Commitments vs Actuals'
      default: return 'Übersicht'
    }
  }, [viewMode])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
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
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
            Aktuelle Ansicht: <span className="font-medium ml-1">{currentViewLabel}</span>
          </div>
          {viewMode === 'csv-import' && (
            <div className="flex items-center text-green-600">
              <Upload className="h-3 w-3 mr-1" />
              <span className="text-xs">Drag & Drop CSV-Dateien hier</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {viewMode === 'csv-import' && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Unterstützte Formate: CSV</span>
            </div>
          )}
          <div className="text-xs text-gray-400">
            Zuletzt aktualisiert: {new Date().toLocaleTimeString('de-DE')}
          </div>
        </div>
      </div>
    </div>
  )
}
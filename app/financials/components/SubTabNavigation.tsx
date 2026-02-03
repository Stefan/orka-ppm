import React from 'react'
import { FileText, TrendingUp, DollarSign } from 'lucide-react'

export type SubTabType = 'variance-analysis' | 'commitments' | 'actuals'

interface SubTabConfig {
  key: SubTabType
  label: string
  icon: any
  description: string
}

interface SubTabNavigationProps {
  activeTab: SubTabType
  onTabChange: (tab: SubTabType) => void
}

const subTabConfig: SubTabConfig[] = [
  { 
    key: 'variance-analysis', 
    label: 'Variance Analysis', 
    icon: TrendingUp, 
    description: 'Compare commitments vs actuals with variance analysis' 
  },
  { 
    key: 'commitments', 
    label: 'Commitments', 
    icon: FileText, 
    description: 'View all imported commitment records' 
  },
  { 
    key: 'actuals', 
    label: 'Actuals', 
    icon: DollarSign, 
    description: 'View all imported actual records' 
  }
]

const SubTabButton = React.memo(({ 
  tab, 
  isActive, 
  onClick 
}: { 
  tab: SubTabConfig
  isActive: boolean
  onClick: () => void 
}) => {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-100
        ${isActive 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700'
        }
      `}
      title={tab.description}
    >
      <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`} />
      <span className="whitespace-nowrap">{tab.label}</span>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-10">
        {tab.description}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-slate-700"></div>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-white dark:bg-slate-200 rounded-full"></div>
      )}
    </button>
  )
})

SubTabButton.displayName = 'SubTabButton'

export default function SubTabNavigation({ activeTab, onTabChange }: SubTabNavigationProps) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1 mb-6">
      <div className="flex gap-1">
        {subTabConfig.map((tab) => (
          <SubTabButton
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
          />
        ))}
      </div>
    </div>
  )
}

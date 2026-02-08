import React from 'react'
import { FileText, TrendingUp, DollarSign } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

export type SubTabType = 'variance-analysis' | 'commitments' | 'actuals'

interface SubTabConfig {
  key: SubTabType
  labelKey: string
  icon: any
}

const subTabConfig: SubTabConfig[] = [
  { key: 'variance-analysis', labelKey: 'financials.varianceAnalysis', icon: TrendingUp },
  { key: 'commitments', labelKey: 'financials.commitments', icon: FileText },
  { key: 'actuals', labelKey: 'financials.actuals', icon: DollarSign },
]

interface SubTabNavigationProps {
  activeTab: SubTabType
  onTabChange: (tab: SubTabType) => void
}

const SubTabButton = React.memo(({ 
  tab, 
  label,
  isActive, 
  onClick 
}: { 
  tab: SubTabConfig
  label: string
  isActive: boolean
  onClick: () => void 
}) => {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-100
        ${isActive 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700'
        }
      `}
    >
      <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
})

SubTabButton.displayName = 'SubTabButton'

export default function SubTabNavigation({ activeTab, onTabChange }: SubTabNavigationProps) {
  const t = useTranslations()
  return (
    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-1 mb-6">
      <div className="flex gap-1">
        {subTabConfig.map((tab) => (
          <SubTabButton
            key={tab.key}
            tab={tab}
            label={t(tab.labelKey as 'financials.varianceAnalysis' | 'financials.commitments' | 'financials.actuals')}
            isActive={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
          />
        ))}
      </div>
    </div>
  )
}

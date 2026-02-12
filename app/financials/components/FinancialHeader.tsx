import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Filter, Download, Edit, ChevronDown, Search } from 'lucide-react'
import { FinancialMetrics, AnalyticsData } from '../types'
import { useTranslations } from '../../../lib/i18n/context'
import PermissionGuard from '../../../components/auth/PermissionGuard'

export interface ProjectOption {
  id: string
  name: string
}

interface FinancialHeaderProps {
  metrics: FinancialMetrics | null
  analyticsData: AnalyticsData | null
  selectedCurrency: string
  showFilters: boolean
  onCurrencyChange: (currency: string) => void
  onToggleFilters: () => void
  onExport?: () => void
  onEditBudget?: () => void
  /** Project selector for Costbook: when provided, dropdown with integrated filter is shown. */
  projects?: ProjectOption[]
  selectedProjectId?: string | null
  onProjectChange?: (projectId: string | null) => void
}

export default function FinancialHeader({
  metrics,
  analyticsData,
  selectedCurrency,
  showFilters: _showFilters,
  onCurrencyChange,
  onToggleFilters,
  onExport,
  onEditBudget,
  projects = [],
  selectedProjectId = null,
  onProjectChange
}: FinancialHeaderProps) {
  const { t } = useTranslations()
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredProjects = projectFilter.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(projectFilter.toLowerCase()))
    : projects

  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null

  useEffect(() => {
    if (!projectDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [projectDropdownOpen])

  return (
    <div className="flex justify-between items-start">
      <div>
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{t('financials.title')}</h1>
          {analyticsData && analyticsData.criticalAlerts > 0 && (
            <div className="flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {analyticsData.criticalAlerts} {analyticsData.criticalAlerts === 1 ? t('financials.criticalAlert') : t('financials.criticalAlerts')}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-slate-400">
          {metrics && (
            <>
              <span>{t('financials.totalBudget')}: {metrics.total_budget.toLocaleString()} {selectedCurrency}</span>
              <span>{t('financials.variance')}: {metrics.variance_percentage.toFixed(1)}%</span>
              <span>{analyticsData?.totalProjects} {t('financials.projectsTracked')}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {onProjectChange != null && (
          <div ref={dropdownRef} className="relative">
            <label id="financials-project-label" className="sr-only">{t('financials.project') || 'Project'}</label>
            <button
              type="button"
              id="financials-project-select"
              aria-haspopup="listbox"
              aria-expanded={projectDropdownOpen}
              aria-labelledby="financials-project-label"
              onClick={() => setProjectDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 min-w-[200px] max-w-[280px] border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 text-sm"
            >
              <span className="flex-1 truncate">
                {selectedProject ? selectedProject.name : (t('financials.selectProject') || 'Select project')}
              </span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {projectDropdownOpen && (
              <div
                role="listbox"
                aria-labelledby="financials-project-label"
                className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[320px] rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg"
              >
                <div className="p-2 border-b border-gray-200 dark:border-slate-600">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      placeholder={t('financials.filterProject') || 'Filter...'}
                      className="w-full pl-8 pr-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label={t('financials.filterProject') || 'Filter projects'}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedProjectId}
                    onClick={() => {
                      onProjectChange(null)
                      setProjectDropdownOpen(false)
                      setProjectFilter('')
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${!selectedProjectId ? 'bg-blue-50 dark:bg-slate-700' : ''}`}
                  >
                    {t('financials.selectProject') || 'Select project'}
                  </button>
                  {filteredProjects.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 dark:text-slate-400 text-center">
                      {projects.length === 0 ? (t('financials.noProjects') || 'No projects') : (t('financials.noMatches') || 'No matches')}
                    </div>
                  ) : (
                    filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={selectedProjectId === p.id}
                        onClick={() => {
                          onProjectChange(p.id)
                          setProjectDropdownOpen(false)
                          setProjectFilter('')
                        }}
                        className={`w-full px-3 py-2 text-left text-sm truncate hover:bg-gray-100 dark:hover:bg-slate-700 ${selectedProjectId === p.id ? 'bg-blue-50 dark:bg-slate-700' : ''}`}
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <select
          value={selectedCurrency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800 text-sm"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>

        {onExport && (
          <PermissionGuard permission="financial_read">
            <button
              onClick={onExport}
              className="flex items-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
              title="Export Financial Report"
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.export')}
            </button>
          </PermissionGuard>
        )}

        {onEditBudget && (
          <PermissionGuard permission="financial_update">
            <button
              onClick={onEditBudget}
              className="flex items-center px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
              title="Edit Budget"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit Budget
            </button>
          </PermissionGuard>
        )}

        <button
          onClick={onToggleFilters}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Filter className="h-4 w-4 mr-1" />
          {t('common.filters')}
        </button>
      </div>
    </div>
  )
}

'use client'

import React, { memo } from 'react'
import { List } from 'react-window'
import { useTranslations } from '@/lib/i18n/context'

interface Resource {
  id: string
  name: string
  email: string
  role?: string | null
  skills: string[]
  utilization_percentage: number
  available_hours: number
  current_projects: string[]
  availability_status: string
}

interface VirtualizedResourceTableProps {
  resources: Resource[]
  height?: number
  itemHeight?: number
  onViewDetails?: (resource: Resource) => void
}

interface RowProps {
  resources: Resource[]
  onViewDetails?: (resource: Resource) => void
}

const VirtualizedResourceTable = memo(function VirtualizedResourceTable({
  resources,
  height = 600,
  itemHeight = 80,
  onViewDetails
}: VirtualizedResourceTableProps) {
  const { t } = useTranslations()
  // Row component for react-window (receives index from List + rowProps)
  const RowComponent = ({ index, style, ...rest }: { index: number; style: React.CSSProperties } & RowProps) => {
    const resource = rest.resources[index]
    const onView = rest.onViewDetails
    return (
      <div className="border-b border-gray-200 dark:border-slate-700" style={style}>
        <div
          className={`px-6 py-4 flex items-center ${onView ? 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 cursor-pointer' : ''}`}
          role={onView ? 'button' : undefined}
          onClick={onView ? () => onView(resource) : undefined}
          onKeyDown={onView ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(resource) } } : undefined}
          tabIndex={onView ? 0 : undefined}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{resource.name}</div>
            <div className="text-sm text-gray-500 dark:text-slate-400 truncate">{resource.email}</div>
          </div>
          <div className="flex-1 px-4">
            <div className="text-sm text-gray-900 dark:text-slate-100">{resource.role || t('resources.unassigned')}</div>
          </div>
          <div className="flex-1 px-4">
            <div className="flex items-center">
              <div className="flex-1 mr-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (resource.utilization_percentage ?? 0) <= 70 ? 'bg-green-500' :
                      (resource.utilization_percentage ?? 0) <= 90 ? 'bg-yellow-500' :
                      (resource.utilization_percentage ?? 0) <= 100 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, resource.utilization_percentage ?? 0)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-900 dark:text-slate-100 w-12 text-right">
                {(resource.utilization_percentage ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex-1 px-4">
            <div className="text-sm text-gray-900 dark:text-slate-100">{(resource.available_hours ?? 0).toFixed(1)}h</div>
          </div>
          <div className="flex-1 px-4">
            <div className="text-sm text-gray-900 dark:text-slate-100">{(resource.current_projects ?? []).length}</div>
          </div>
          <div className="flex-1 px-4">
            <div className="flex flex-wrap gap-1">
              {(resource.skills ?? []).slice(0, 2).map((skill, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                  {skill}
                </span>
              ))}
              {(resource.skills ?? []).length > 2 && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded">
                  {t('resources.moreSkills', { count: (resource.skills ?? []).length - 2 })}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 px-4">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              resource.availability_status === 'available' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
              resource.availability_status === 'partially_allocated' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
              resource.availability_status === 'mostly_allocated' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
              'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            }`}>
              {resource.availability_status === 'available' ? t('resources.availableStatus') : resource.availability_status === 'partially_allocated' ? t('resources.partiallyAllocated') : resource.availability_status === 'mostly_allocated' ? t('resources.mostlyAllocated') : t('resources.fullyAllocated')}
            </span>
          </div>
          {onView && (
            <div className="flex-1 px-4 flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onView(resource) }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 min-h-[44px] px-3 py-2 rounded touch-manipulation"
              >
                {t('resources.viewDetails')}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Only use virtual scrolling for tables with more than 50 rows
  if (resources.length <= 50) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.resources')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.role')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.utilization')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.availableHours')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.currentProjects')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.skills')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.availability')}</th>
                {onViewDetails && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {resources.map((resource) => (
                <tr
                  key={resource.id}
                  className={onViewDetails ? 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 cursor-pointer' : ''}
                  role={onViewDetails ? 'button' : undefined}
                  onClick={onViewDetails ? () => onViewDetails(resource) : undefined}
                  onKeyDown={onViewDetails ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetails(resource) } } : undefined}
                  tabIndex={onViewDetails ? 0 : undefined}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{resource.name}</div>
                      <div className="text-sm text-gray-500 dark:text-slate-400">{resource.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {resource.role || t('resources.unassigned')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 mr-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                    className={`h-2 rounded-full ${
                      (resource.utilization_percentage ?? 0) <= 70 ? 'bg-green-500' :
                      (resource.utilization_percentage ?? 0) <= 90 ? 'bg-yellow-500' :
                      (resource.utilization_percentage ?? 0) <= 100 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, resource.utilization_percentage ?? 0)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-900 dark:text-slate-100">{(resource.utilization_percentage ?? 0).toFixed(1)}%</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
            {(resource.available_hours ?? 0).toFixed(1)}h
          </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {(resource.current_projects ?? []).length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {(resource.skills ?? []).slice(0, 2).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {(resource.skills ?? []).length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded">
                          {t('resources.moreSkills', { count: (resource.skills ?? []).length - 2 })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      resource.availability_status === 'available' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      resource.availability_status === 'partially_allocated' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                      resource.availability_status === 'mostly_allocated' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {resource.availability_status === 'available' ? t('resources.availableStatus') : resource.availability_status === 'partially_allocated' ? t('resources.partiallyAllocated') : resource.availability_status === 'mostly_allocated' ? t('resources.mostlyAllocated') : t('resources.fullyAllocated')}
                    </span>
                  </td>
                  {onViewDetails && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(resource) }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 min-h-[44px] px-3 py-2 rounded touch-manipulation"
                      >
                        {t('resources.viewDetails')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.resources')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.role')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.utilization')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.availableHours')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.currentProjects')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.skills')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('resources.availability')}</th>
            </tr>
          </thead>
        </table>
        <List<RowProps>
          defaultHeight={height}
          rowCount={resources.length}
          rowHeight={itemHeight}
          rowComponent={RowComponent}
          rowProps={{ resources, onViewDetails }}
        />
      </div>
    </div>
  )
})

export default VirtualizedResourceTable

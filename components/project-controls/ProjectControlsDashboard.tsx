'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import ETCEACCalculator from './ETCEACCalculator'
import ForecastViewer from './ForecastViewer'
import EarnedValueDashboard from './EarnedValueDashboard'
import PerformanceAnalytics from './PerformanceAnalytics'
import ResourceIntegration from './ResourceIntegration'

function AnalyticsTab({ projectId }: { projectId: string }) {
  const [resourceForecast, setResourceForecast] = useState<{ total_planned_hours?: number; estimated_cost?: number } | null>(null)
  useEffect(() => {
    projectControlsApi.getResourceForecast(projectId).then(setResourceForecast).catch(() => setResourceForecast(null))
  }, [projectId])
  return (
    <div className="space-y-4">
      <PerformanceAnalytics projectId={projectId} />
      <ResourceIntegration
        projectId={projectId}
        plannedHours={resourceForecast?.total_planned_hours}
        estimatedCost={resourceForecast?.estimated_cost}
      />
    </div>
  )
}

interface ProjectControlsDashboardProps {
  projectId: string
}

export default function ProjectControlsDashboard({ projectId }: ProjectControlsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'etc-eac' | 'forecast' | 'ev' | 'analytics'>('etc-eac')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        {(['etc-eac', 'forecast', 'ev', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 -mb-px capitalize ${activeTab === tab ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-600'}`}
          >
            {tab === 'etc-eac' ? 'ETC/EAC' : tab === 'ev' ? 'Earned Value' : tab}
          </button>
        ))}
      </div>
      {activeTab === 'etc-eac' && <ETCEACCalculator projectId={projectId} />}
      {activeTab === 'forecast' && <ForecastViewer projectId={projectId} />}
      {activeTab === 'ev' && <EarnedValueDashboard projectId={projectId} />}
      {activeTab === 'analytics' && (
        <AnalyticsTab projectId={projectId} />
      )}
    </div>
  )
}

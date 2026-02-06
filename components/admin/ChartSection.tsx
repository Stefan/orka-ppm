'use client'

import React from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

interface ChartDataPoint {
  endpoint: string
  fullEndpoint: string
  avg_duration: number
  requests: number
  error_rate: number
  rpm: number
}

interface SlowQueryDataPoint {
  endpoint: string
  duration: number
  time: string
}

interface ChartSectionProps {
  endpointData: ChartDataPoint[]
  slowQueriesData: SlowQueryDataPoint[]
  translations: {
    endpointPerformance: string
    avgDuration: string
    totalRequestsLabel: string
    errorRate: string
    requestsPerMin: string
    requestVolume: string
  }
}

export const ChartSection = React.memo(function ChartSection({ 
  endpointData, 
  slowQueriesData,
  translations 
}: ChartSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Endpoint Performance */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {translations.endpointPerformance}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={endpointData}>
            <XAxis dataKey="endpoint" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                name === 'avg_duration' ? `${value}ms` : value,
                name === 'avg_duration' ? translations.avgDuration : 
                name === 'requests' ? translations.totalRequestsLabel : 
                name === 'error_rate' ? translations.errorRate + ' %' : translations.requestsPerMin
              ]}
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data?.fullEndpoint || label;
              }}
            />
            <Legend />
            <Bar dataKey="avg_duration" fill="#3B82F6" name={translations.avgDuration + ' (ms)'} />
            <Bar dataKey="error_rate" fill="#EF4444" name={translations.errorRate + ' %'} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Request Volume */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {translations.requestVolume}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={endpointData}>
            <XAxis dataKey="endpoint" />
            <YAxis />
            <Tooltip 
              labelFormatter={(label, payload) => {
                const data = payload?.[0]?.payload;
                return data?.fullEndpoint || label;
              }}
            />
            <Legend />
            <Bar dataKey="requests" fill="#10B981" name={translations.totalRequestsLabel} />
            <Bar dataKey="rpm" fill="#F59E0B" name={translations.requestsPerMin} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})

'use client'


import { Project, BudgetVariance, AnalyticsData } from '../../types'

interface BudgetVarianceTableProps {
  budgetVariances: BudgetVariance[]
  projects: Project[]
  selectedCurrency: string
  analyticsData: AnalyticsData | null
}

export default function BudgetVarianceTable({ 
  budgetVariances, 
  projects, 
  selectedCurrency, 
  analyticsData 
}: BudgetVarianceTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Budget-Abweichungsanalyse ({budgetVariances.length} Projekte)
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Alle Beträge in {selectedCurrency}</span>
            {analyticsData && (
              <>
                <span>•</span>
                <span>Ø Effizienz: {analyticsData.avgEfficiency.toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projekt</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ist</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abweichung</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abweichung %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effizienz</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gesundheit</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {budgetVariances
              .sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))
              .map((variance) => {
                const project = projects.find(p => p.id === variance.project_id)
                const efficiency = variance.total_planned > 0 ? 
                  Math.max(0, 100 - Math.abs(variance.variance_percentage)) : 0
                
                return (
                  <tr key={variance.project_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {project?.name || 'Unbekanntes Projekt'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {variance.total_planned.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {variance.total_actual.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={variance.variance_amount >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {variance.variance_amount >= 0 ? '+' : ''}{variance.variance_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={variance.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {variance.variance_percentage >= 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              efficiency >= 80 ? 'bg-green-500' : 
                              efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                          >
                          </div>
                        </div>
                        <span className={
                          efficiency >= 80 ? 'text-green-600' : 
                          efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }
                        >
                          {efficiency.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        variance.status === 'over_budget' ? 'bg-red-100 text-red-800' :
                        variance.status === 'under_budget' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                      >
                        {variance.status === 'over_budget' ? 'Über Budget' :
                         variance.status === 'under_budget' ? 'Unter Budget' : 'Im Budget'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project?.health === 'green' ? 'bg-green-100 text-green-800' :
                        project?.health === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        project?.health === 'red' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                      >
                        {project?.health === 'green' ? 'Gut' :
                         project?.health === 'yellow' ? 'Warnung' :
                         project?.health === 'red' ? 'Kritisch' : 'Unbekannt'}
                      </span>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      
      {/* Table Summary */}
      {analyticsData && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Gesamteinsparungen:</span>
              <div className="font-semibold text-green-600">
                {analyticsData.totalSavings.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Gesamtüberschreitungen:</span>
              <div className="font-semibold text-red-600">
                {analyticsData.totalOverruns.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Netto-Abweichung:</span>
              <div className={`font-semibold ${analyticsData.netVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {analyticsData.netVariance >= 0 ? '+' : ''}{analyticsData.netVariance.toLocaleString()} {selectedCurrency}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Portfolio-Effizienz:</span>
              <div className="font-semibold text-blue-600">
                {analyticsData.avgEfficiency.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
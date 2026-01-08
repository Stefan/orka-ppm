'use client'


import { AreaChart, Area, Line, ComposedChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ComprehensiveFinancialReport } from '../../types'

interface TrendsViewProps {
  comprehensiveReport: ComprehensiveFinancialReport | null
  selectedCurrency: string
}

export default function TrendsView({ comprehensiveReport, selectedCurrency }: TrendsViewProps) {
  if (!comprehensiveReport?.trend_projections) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">Keine Trenddaten verfügbar</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Finanzielle Trendprognosen</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>Prognose für die nächsten 6 Monate</span>
          <span>•</span>
          <span>Währung: {selectedCurrency}</span>
          <span>•</span>
          <span>Basierend auf aktuellen Ausgabenmustern</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Trend Chart with Confidence Bands */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">Prognostizierter Ausgabentrend</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={comprehensiveReport.trend_projections}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                name === 'projected_spending' ? 'Prognostizierte Ausgaben' : 'Prognostizierte Abweichung'
              ]}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="projected_spending" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.3}
                name="Prognostizierte Ausgaben"
              />
              <Line 
                type="monotone" 
                dataKey="projected_variance" 
                stroke="#EF4444" 
                strokeWidth={2}
                name="Prognostizierte Abweichung"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence Levels with Risk Assessment */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">Prognose-Vertrauen & Risiko</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={comprehensiveReport.trend_projections}>
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value, name) => [
                name === 'confidence' ? `${((value as number) * 100).toFixed(1)}%` : 
                typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                name === 'confidence' ? 'Vertrauensniveau' : 'Risikobetrag'
              ]}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="confidence" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                name="Vertrauensniveau"
              />
              <Bar 
                yAxisId="right"
                dataKey="projected_variance" 
                fill="#F59E0B" 
                fillOpacity={0.6}
                name="Risikobetrag"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Indicators from Comprehensive Report */}
      {comprehensiveReport.risk_indicators && (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-800 mb-4">Finanzielle Risikobewertung</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {comprehensiveReport.risk_indicators.projects_over_budget}
              </div>
              <div className="text-sm text-red-800">Projekte über Budget</div>
              <div className="text-xs text-red-600 mt-1">Hohes Risiko</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">
                {comprehensiveReport.risk_indicators.projects_at_risk}
              </div>
              <div className="text-sm text-yellow-800">Projekte mit Risiko</div>
              <div className="text-xs text-yellow-600 mt-1">Mittleres Risiko</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">
                {comprehensiveReport.risk_indicators.critical_projects}
              </div>
              <div className="text-sm text-orange-800">Kritische Projekte</div>
              <div className="text-xs text-orange-600 mt-1">Sofortige Aufmerksamkeit</div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {comprehensiveReport.risk_indicators.average_utilization.toFixed(1)}%
              </div>
              <div className="text-sm text-blue-800">Ø Auslastung</div>
              <div className="text-xs text-blue-600 mt-1">Portfolio-Effizienz</div>
            </div>
          </div>
        </div>
      )}

      {/* Projection Summary */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-gray-800 mb-2">6-Monats-Prognose Zusammenfassung</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Erwartete Gesamtausgaben:</span>
            <div className="font-semibold text-gray-900">
              {comprehensiveReport.trend_projections[5]?.projected_spending.toLocaleString()} {selectedCurrency}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Prognostizierte Abweichung:</span>
            <div className={`font-semibold ${
              (comprehensiveReport.trend_projections[5]?.projected_variance || 0) >= 0 ? 'text-red-600' : 'text-green-600'
            }`}
            >
              {(comprehensiveReport.trend_projections[5]?.projected_variance || 0) >= 0 ? '+' : ''}
              {comprehensiveReport.trend_projections[5]?.projected_variance.toLocaleString()} {selectedCurrency}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Vertrauensniveau:</span>
            <div className="font-semibold text-gray-900">
              {((comprehensiveReport.trend_projections[5]?.confidence || 0) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
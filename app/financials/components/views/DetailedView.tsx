'use client'


import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ComprehensiveFinancialReport } from '../../types'

interface DetailedViewProps {
  comprehensiveReport: ComprehensiveFinancialReport | null
  selectedCurrency: string
}

export default function DetailedView({ comprehensiveReport, selectedCurrency }: DetailedViewProps) {
  if (!comprehensiveReport?.category_spending) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">Keine Kategoriedaten verfügbar</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Detaillierte Kategorieanalyse</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>Alle Beträge in {selectedCurrency}</span>
          <span>•</span>
          <span>{comprehensiveReport.category_spending.length} Kategorien</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Chart */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">Kategorieverteilung</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comprehensiveReport.category_spending}>
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                name === 'total_spending' ? 'Gesamtausgaben' : 'Durchschnitt pro Transaktion'
              ]}
              />
              <Legend />
              <Bar dataKey="total_spending" fill="#3B82F6" name="Gesamtausgaben" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Details Table */}
        <div className="overflow-x-auto">
          <h4 className="text-md font-medium text-gray-800 mb-3">Kategorie-Leistungsmetriken</h4>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ausgaben</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaktionen</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ø/Transaktion</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">% vom Gesamt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comprehensiveReport.category_spending
                .sort((a, b) => b.total_spending - a.total_spending)
                .map((category, index) => {
                  const totalSpending = comprehensiveReport.category_spending.reduce((sum, cat) => sum + cat.total_spending, 0)
                  const percentage = totalSpending > 0 ? (category.total_spending / totalSpending * 100) : 0
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{category.category}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {category.total_spending.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{category.transaction_count}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {category.average_per_transaction.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            >
                            </div>
                          </div>
                          <span className="text-gray-600">{percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Insights */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-blue-800 mb-2">Kategorie-Einblicke</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-blue-600">Höchste Ausgabenkategorie:</span>
            <div className="font-semibold text-blue-900">
              {comprehensiveReport.category_spending
                .sort((a, b) => b.total_spending - a.total_spending)[0]?.category || 'N/A'}
            </div>
          </div>
          <div>
            <span className="text-blue-600">Aktivste Kategorie:</span>
            <div className="font-semibold text-blue-900">
              {comprehensiveReport.category_spending
                .sort((a, b) => b.transaction_count - a.transaction_count)[0]?.category || 'N/A'}
            </div>
          </div>
          <div>
            <span className="text-blue-600">Höchste Ø-Transaktion:</span>
            <div className="font-semibold text-blue-900">
              {comprehensiveReport.category_spending
                .sort((a, b) => b.average_per_transaction - a.average_per_transaction)[0]?.category || 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

interface PerformanceKPIsProps {
  cpi?: number
  spi?: number
  eac?: number
  vac?: number
}

export default function PerformanceKPIs({ cpi = 0, spi = 0, eac = 0, vac = 0 }: PerformanceKPIsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
        <p className="text-xs text-gray-500 dark:text-slate-400">CPI</p>
        <p className={`text-xl font-bold ${cpi >= 1 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>{cpi.toFixed(2)}</p>
      </div>
      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
        <p className="text-xs text-gray-500 dark:text-slate-400">SPI</p>
        <p className={`text-xl font-bold ${spi >= 1 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>{spi.toFixed(2)}</p>
      </div>
      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
        <p className="text-xs text-gray-500 dark:text-slate-400">EAC</p>
        <p className="text-xl font-bold">${eac.toLocaleString()}</p>
      </div>
      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border">
        <p className="text-xs text-gray-500 dark:text-slate-400">VAC</p>
        <p className={`text-xl font-bold ${vac >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>${vac.toLocaleString()}</p>
      </div>
    </div>
  )
}

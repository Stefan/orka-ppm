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
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">CPI</p>
        <p className={`text-xl font-bold ${cpi >= 1 ? 'text-green-600' : 'text-amber-600'}`}>{cpi.toFixed(2)}</p>
      </div>
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">SPI</p>
        <p className={`text-xl font-bold ${spi >= 1 ? 'text-green-600' : 'text-amber-600'}`}>{spi.toFixed(2)}</p>
      </div>
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">EAC</p>
        <p className="text-xl font-bold">${eac.toLocaleString()}</p>
      </div>
      <div className="p-3 bg-white rounded-lg border">
        <p className="text-xs text-gray-500">VAC</p>
        <p className={`text-xl font-bold ${vac >= 0 ? 'text-green-600' : 'text-red-600'}`}>${vac.toLocaleString()}</p>
      </div>
    </div>
  )
}

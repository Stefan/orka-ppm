'use client'

interface PerformanceGaugesProps {
  cpi: number
  spi: number
  tcpi?: number
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(150, Math.max(0, value * 50))
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 h-2 bg-gray-100 dark:bg-slate-700 rounded overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm font-bold mt-1">{value.toFixed(2)}</p>
    </div>
  )
}

export default function PerformanceGauges({ cpi, spi, tcpi }: PerformanceGaugesProps) {
  const cpiColor = cpi >= 1 ? 'bg-green-500' : cpi >= 0.9 ? 'bg-amber-500' : 'bg-red-500'
  const spiColor = spi >= 1 ? 'bg-green-500' : spi >= 0.9 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Gauge label="CPI" value={cpi} color={cpiColor} />
      <Gauge label="SPI" value={spi} color={spiColor} />
      {tcpi !== undefined && <Gauge label="TCPI" value={tcpi} color="bg-indigo-500" />}
    </div>
  )
}

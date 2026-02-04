'use client'

interface CalculationMethodSelectorProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}

export default function CalculationMethodSelector({
  label,
  value,
  onChange,
  options,
  disabled,
}: CalculationMethodSelectorProps) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

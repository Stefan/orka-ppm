'use client'

import { REGISTER_TYPE_LABELS, type RegisterType } from '@/types/registers'
import { ChevronDown } from 'lucide-react'

const PRIORITY_ORDER: RegisterType[] = [
  'risk',
  'change',
  'cost',
  'issue',
  'benefits',
  'lessons_learned',
  'decision',
  'opportunities',
]

export interface RegisterTypeSelectorProps {
  value: RegisterType
  onChange: (type: RegisterType) => void
  disabled?: boolean
  className?: string
}

export default function RegisterTypeSelector({
  value,
  onChange,
  disabled,
  className = '',
}: RegisterTypeSelectorProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RegisterType)}
        disabled={disabled}
        className="w-full min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        aria-label="Register type"
      >
        {PRIORITY_ORDER.map((type) => (
          <option key={type} value={type}>
            {REGISTER_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-slate-400"
        aria-hidden
      />
    </div>
  )
}

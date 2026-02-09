'use client'

import { REGISTER_TYPE_LABELS, type RegisterType } from '@/types/registers'
import Select from '@/components/ui/Select'

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

const REGISTER_TYPE_OPTIONS = PRIORITY_ORDER.map((type) => ({
  value: type,
  label: REGISTER_TYPE_LABELS[type],
}))

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
    <Select
      value={value}
      onChange={(v) => onChange(v as RegisterType)}
      options={REGISTER_TYPE_OPTIONS}
      disabled={disabled}
      className={`min-w-[180px] ${className}`}
    />
  )
}

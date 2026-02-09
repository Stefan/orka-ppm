'use client'

/**
 * Costbook Register Grid - Projects with nested commitments/actuals
 * Requirements: 10.1, 10.2, 10.3
 */

import React, { useState, useEffect } from 'react'
import { RegisterGrid } from './index'
import { useNestedGridConfig } from '@/lib/register-nested-grids/hooks'
import { fetchNestedGridConfig } from '@/lib/register-nested-grids/api'
import type { NestedGridConfig, Section } from './types'

interface ProjectRow {
  id: string
  name?: string
  budget?: number
  eac?: number
  variance?: number
  [key: string]: unknown
}

interface CostbookRegisterGridProps {
  projects: ProjectRow[]
  registerId?: string
  columns?: { field: string; headerName: string }[]
}

const DEFAULT_COLUMNS = [
  { field: 'name', headerName: 'Project' },
  { field: 'budget', headerName: 'Budget' },
  { field: 'eac', headerName: 'EAC' },
  { field: 'variance', headerName: 'Variance' },
]

export default function CostbookRegisterGrid({
  projects,
  registerId = 'costbook',
  columns = DEFAULT_COLUMNS,
}: CostbookRegisterGridProps) {
  const [config, setConfig] = useState<NestedGridConfig | null>(null)
  const { data } = useNestedGridConfig(registerId)

  useEffect(() => {
    if (data) setConfig({ sections: data.sections as unknown as Section[], enableLinkedItems: data.enableLinkedItems })
    else fetchNestedGridConfig(registerId).then((c) => c && setConfig({ sections: c.sections as unknown as Section[], enableLinkedItems: c.enableLinkedItems }))
  }, [registerId, data])

  const getLinkedCount = () => 1

  return (
    <div data-testid="costbook-register-grid">
      <RegisterGrid
        registerId={registerId}
        rows={projects}
        config={config}
        getRowId={(r) => r.id}
        columns={columns}
        renderCell={(row, field) => {
          const v = row[field]
          if (typeof v === 'number') return v.toLocaleString()
          return String(v ?? '-')
        }}
        getLinkedCount={getLinkedCount}
      />
    </div>
  )
}

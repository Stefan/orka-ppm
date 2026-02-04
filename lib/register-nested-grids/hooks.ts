/**
 * React Query hooks for Register Nested Grids
 * Requirements: 4.2, 5.2, 7.3, 8.3
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchNestedGridConfig,
  fetchNestedGridData,
  updateNestedGridItem,
  reorderNestedGridRows,
} from './api'
import type { ItemType } from '@/components/register-nested-grids/types'

const STALE_TIME = 5 * 60 * 1000 // 5 minutes

export function useNestedGridConfig(registerId: string, enabled = true) {
  return useQuery({
    queryKey: ['nested-grid-config', registerId],
    queryFn: () => fetchNestedGridConfig(registerId),
    enabled: !!registerId && enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useNestedGridData(parentRowId: string, itemType: ItemType, enabled = true) {
  return useQuery({
    queryKey: ['nested-grid', parentRowId, itemType],
    queryFn: () => fetchNestedGridData(parentRowId, itemType),
    enabled: !!parentRowId && !!itemType && enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useUpdateNestedGridItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      rowId,
      field,
      value,
      itemType,
    }: {
      rowId: string
      field: string
      value: unknown
      itemType?: ItemType
    }) => updateNestedGridItem(rowId, field, value, itemType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nested-grid', variables.rowId] })
    },
  })
}

export function useReorderRows() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      parentRowId,
      rowIds,
      itemType,
    }: {
      parentRowId: string
      rowIds: string[]
      itemType?: ItemType
    }) => reorderNestedGridRows(parentRowId, rowIds, itemType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nested-grid', variables.parentRowId] })
    },
  })
}

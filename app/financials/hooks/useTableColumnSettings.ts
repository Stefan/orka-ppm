'use client'

import { useState, useCallback, useMemo } from 'react'

const STORAGE_PREFIX = 'financials-table-columns'

export interface ColumnDef<TKey extends string = string> {
  key: TKey
  labelKey: string
  width?: string
  format?: (value: unknown) => string
}

export interface StoredColumnSettings {
  order: string[]
  hidden: string[]
}

function loadSettings(storageKey: string): StoredColumnSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${storageKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredColumnSettings
    if (Array.isArray(parsed.order) && Array.isArray(parsed.hidden)) return parsed
    return null
  } catch {
    return null
  }
}

function saveSettings(storageKey: string, settings: StoredColumnSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${storageKey}`, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

/**
 * Hook for table column visibility and order with localStorage persistence.
 * @param storageKey e.g. 'commitments' or 'actuals'
 * @param defaultColumns full column definitions in default order
 */
export function useTableColumnSettings<TKey extends string>(
  storageKey: string,
  defaultColumns: ColumnDef<TKey>[]
) {
  const defaultOrder = defaultColumns.map((c) => c.key)
  const defaultHidden: string[] = []

  const [settings, setSettings] = useState<StoredColumnSettings>(() => {
    const stored = loadSettings(storageKey)
    if (!stored) return { order: defaultOrder, hidden: defaultHidden }
    // Merge: ensure all current column keys exist in order, new columns appended
    const knownKeys = new Set<string>(defaultOrder)
    const order = [
      ...stored.order.filter((k: string) => knownKeys.has(k)),
      ...defaultOrder.filter((k: string) => !stored.order.includes(k)),
    ]
    const hidden = stored.hidden.filter((k: string) => knownKeys.has(k))
    return { order, hidden }
  })

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setSettings((prev) => {
        const next = { ...prev, order }
        saveSettings(storageKey, next)
        return next
      })
    },
    [storageKey]
  )

  const setColumnVisible = useCallback(
    (key: string, visible: boolean) => {
      setSettings((prev) => {
        const hidden = visible
          ? prev.hidden.filter((k) => k !== key)
          : prev.hidden.includes(key)
            ? prev.hidden
            : [...prev.hidden, key]
        const next = { ...prev, hidden }
        saveSettings(storageKey, next)
        return next
      })
    },
    [storageKey]
  )

  const resetToDefault = useCallback(() => {
    const next: StoredColumnSettings = { order: defaultOrder, hidden: defaultHidden }
    saveSettings(storageKey, next)
    setSettings(next)
  }, [storageKey, defaultOrder])

  const visibleColumns = useMemo(() => {
    const byKey = new Map<string, ColumnDef<TKey>>(defaultColumns.map((c) => [c.key, c]))
    const ordered = settings.order
      .map((key) => byKey.get(key))
      .filter(Boolean) as ColumnDef<TKey>[]
    return ordered.filter((c) => !settings.hidden.includes(c.key))
  }, [defaultColumns, settings.order, settings.hidden])

  const allColumnsOrdered = useMemo(() => {
    const byKey = new Map<string, ColumnDef<TKey>>(defaultColumns.map((c) => [c.key, c]))
    return settings.order
      .map((key) => byKey.get(key))
      .filter(Boolean) as ColumnDef<TKey>[]
  }, [defaultColumns, settings.order])

  return {
    visibleColumns,
    allColumnsOrdered,
    hiddenSet: new Set(settings.hidden),
    order: settings.order,
    setColumnOrder,
    setColumnVisible,
    resetToDefault,
    defaultColumns,
  }
}

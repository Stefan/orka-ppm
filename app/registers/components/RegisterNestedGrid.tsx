'use client'

import type { RegisterNestedSchema } from '@/types/registers'

export interface RegisterNestedGridProps {
  schema: RegisterNestedSchema
  items: Record<string, unknown>[]
}

/** Displays a nested array from entry.data (e.g. mitigations, actions). Spec: Task 3.6 Nested Grids */
export default function RegisterNestedGrid({ schema, items }: RegisterNestedGridProps) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        {schema.label}: none
      </div>
    )
  }
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs font-medium text-gray-600 dark:text-slate-400">{schema.label}</div>
      <div className="overflow-x-auto rounded border border-gray-200 dark:border-slate-600">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              {schema.columns.map((col) => (
                <th key={col.key} className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-slate-400">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {items.map((row, i) => (
              <tr key={i}>
                {schema.columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5 text-gray-700 dark:text-slate-300">
                    {String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

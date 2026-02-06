'use client'

export interface LineItemRow {
  description: string
  trade_category: string
  unit_of_measure: string
  quantity: number
  unit_rate: number
  markup_percentage: number
  overhead_percentage: number
  contingency_percentage: number
  cost_category: string
  is_add: boolean
}

const COST_CATEGORIES = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontract', label: 'Subcontract' },
  { value: 'other', label: 'Other' },
]

interface LineItemEditorProps {
  items: LineItemRow[]
  onChange: (items: LineItemRow[]) => void
}

const emptyRow: LineItemRow = {
  description: '',
  trade_category: '',
  unit_of_measure: 'EA',
  quantity: 0,
  unit_rate: 0,
  markup_percentage: 0,
  overhead_percentage: 0,
  contingency_percentage: 0,
  cost_category: 'labor',
  is_add: true,
}

function calcTotal(item: LineItemRow): number {
  const ext = item.quantity * item.unit_rate
  const markup = ext * (item.markup_percentage / 100)
  const overhead = ext * (item.overhead_percentage / 100)
  const contingency = ext * (item.contingency_percentage / 100)
  return ext + markup + overhead + contingency
}

export default function LineItemEditor({ items, onChange }: LineItemEditorProps) {
  const addRow = () => onChange([...items, { ...emptyRow }])
  const removeRow = (idx: number) => {
    if (items.length <= 1) return
    onChange(items.filter((_, i) => i !== idx))
  }
  const updateRow = (idx: number, field: keyof LineItemRow, value: unknown) => {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: value }
    onChange(next)
  }

  const total = items.reduce((sum, i) => sum + calcTotal(i), 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Line Items</h4>
        <button type="button" onClick={addRow} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          + Add Line
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="p-3 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Line {idx + 1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => removeRow(idx)} className="text-red-600 dark:text-red-400 text-sm">
                  Remove
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateRow(idx, 'description', e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Trade"
                value={item.trade_category}
                onChange={(e) => updateRow(idx, 'trade_category', e.target.value)}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="text"
                placeholder="UoM"
                value={item.unit_of_measure}
                onChange={(e) => updateRow(idx, 'unit_of_measure', e.target.value)}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="number"
                placeholder="Qty"
                value={item.quantity || ''}
                onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="number"
                placeholder="Rate"
                value={item.unit_rate || ''}
                onChange={(e) => updateRow(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                className="px-2 py-1 text-sm border rounded"
              />
            </div>
            <select
              value={item.cost_category}
              onChange={(e) => updateRow(idx, 'cost_category', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              {COST_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="pt-2 font-medium">Estimated Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
    </div>
  )
}

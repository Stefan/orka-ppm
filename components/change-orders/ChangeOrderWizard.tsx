'use client'

import { useState } from 'react'
import { changeOrdersApi, type ChangeOrder, type ChangeOrderCreate } from '@/lib/change-orders-api'

const CATEGORIES = [
  { value: 'owner_directed', label: 'Owner Directed' },
  { value: 'design_change', label: 'Design Change' },
  { value: 'field_condition', label: 'Field Condition' },
  { value: 'regulatory', label: 'Regulatory' },
]

const SOURCES = [
  { value: 'owner', label: 'Owner' },
  { value: 'designer', label: 'Designer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'regulatory_agency', label: 'Regulatory Agency' },
]

const COST_CATEGORIES = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontract', label: 'Subcontract' },
  { value: 'other', label: 'Other' },
]

interface LineItem {
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

interface ChangeOrderWizardProps {
  projectId: string
  onComplete: (order: ChangeOrder) => void
  onCancel: () => void
}

const emptyLineItem: LineItem = {
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

export default function ChangeOrderWizard({
  projectId,
  onComplete,
  onCancel,
}: ChangeOrderWizardProps) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<Partial<ChangeOrderCreate>>({
    project_id: projectId,
    title: '',
    description: '',
    justification: '',
    change_category: 'owner_directed',
    change_source: 'owner',
    impact_type: ['cost'],
    priority: 'medium',
    original_contract_value: 0,
    proposed_schedule_impact_days: 0,
    line_items: [],
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLineItem }])

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { ...emptyLineItem }])
  }

  const updateLineItem = (idx: number, field: keyof LineItem, value: unknown) => {
    setLineItems((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) return
    setLineItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalFromLineItems = lineItems.reduce((sum, li) => {
    const ext = li.quantity * li.unit_rate
    const markup = ext * (li.markup_percentage / 100)
    const overhead = ext * (li.overhead_percentage / 100)
    const contingency = ext * (li.contingency_percentage / 100)
    return sum + ext + markup + overhead + contingency
  }, 0)

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const payload: ChangeOrderCreate = {
        project_id: projectId,
        title: form.title!,
        description: form.description!,
        justification: form.justification!,
        change_category: form.change_category!,
        change_source: form.change_source!,
        impact_type: form.impact_type ?? ['cost'],
        priority: form.priority ?? 'medium',
        original_contract_value: form.original_contract_value ?? 0,
        proposed_schedule_impact_days: form.proposed_schedule_impact_days ?? 0,
        contract_reference: form.contract_reference,
        line_items: lineItems
          .filter((li) => li.description && li.quantity > 0 && li.unit_rate >= 0)
          .map((li) => ({
            description: li.description,
            trade_category: li.trade_category || 'General',
            unit_of_measure: li.unit_of_measure,
            quantity: li.quantity,
            unit_rate: li.unit_rate,
            markup_percentage: li.markup_percentage,
            overhead_percentage: li.overhead_percentage,
            contingency_percentage: li.contingency_percentage,
            cost_category: li.cost_category,
            is_add: li.is_add,
          })),
      }
      const order = await changeOrdersApi.create(payload)
      onComplete(order)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create change order')
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedStep1 =
    form.title &&
    form.title.length >= 5 &&
    form.description &&
    form.description.length >= 10 &&
    form.justification &&
    form.justification.length >= 10 &&
    (form.original_contract_value ?? 0) > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Create Change Order</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Step {step} of 2: {step === 1 ? 'Basic Information' : 'Line Items'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">{error}</div>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Change order title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Justification *
                </label>
                <textarea
                  value={form.justification ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={form.change_category ?? 'owner_directed'}
                    onChange={(e) => setForm((f) => ({ ...f, change_category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Source</label>
                  <select
                    value={form.change_source ?? 'owner'}
                    onChange={(e) => setForm((f) => ({ ...f, change_source: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Original Contract Value *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.original_contract_value ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        original_contract_value: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Schedule Impact (days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.proposed_schedule_impact_days ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        proposed_schedule_impact_days: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Line Items</h3>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add Line
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Line {idx + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="text-red-600 dark:text-red-400 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Trade"
                        value={li.trade_category}
                        onChange={(e) => updateLineItem(idx, 'trade_category', e.target.value)}
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="text"
                        placeholder="UoM"
                        value={li.unit_of_measure}
                        onChange={(e) => updateLineItem(idx, 'unit_of_measure', e.target.value)}
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={li.quantity || ''}
                        onChange={(e) =>
                          updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="px-2 py-1 text-sm border rounded"
                      />
                      <input
                        type="number"
                        placeholder="Rate"
                        value={li.unit_rate || ''}
                        onChange={(e) =>
                          updateLineItem(idx, 'unit_rate', parseFloat(e.target.value) || 0)
                        }
                        className="px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <select
                      value={li.cost_category}
                      onChange={(e) => updateLineItem(idx, 'cost_category', e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      {COST_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="pt-2 font-medium">
                Estimated Total: ${totalFromLineItems.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t flex justify-between">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Change Order'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

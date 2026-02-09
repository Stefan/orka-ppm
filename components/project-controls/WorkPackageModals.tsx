'use client'

import { useState } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import type { WorkPackage } from '@/types/project-controls'
import { Loader2 } from 'lucide-react'

export function CopyFromProjectModal({
  currentProjectId,
  onClose,
  onCopied,
}: {
  currentProjectId: string
  onClose: () => void
  onCopied: () => void
}) {
  const [sourceProjectId, setSourceProjectId] = useState('')
  const [resetBudgetDates, setResetBudgetDates] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleCopy = async () => {
    if (!sourceProjectId.trim()) return
    setError(null)
    setLoading(true)
    try {
      const data = (await projectControlsApi.listWorkPackages(sourceProjectId.trim(), false)) as WorkPackage[]
      for (const wp of data) {
        await projectControlsApi.createWorkPackage(currentProjectId, {
          project_id: currentProjectId,
          name: wp.name,
          description: wp.description ?? null,
          budget: resetBudgetDates ? 0 : wp.budget,
          start_date: resetBudgetDates ? new Date().toISOString().slice(0, 10) : (wp.start_date?.slice(0, 10) ?? ''),
          end_date: resetBudgetDates ? new Date().toISOString().slice(0, 10) : (wp.end_date?.slice(0, 10) ?? ''),
          responsible_manager: wp.responsible_manager,
          parent_package_id: null,
        })
      }
      onCopied()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-semibold">Copy from project</h4>
        <p className="text-sm text-gray-600 dark:text-slate-400">Enter source project ID. Work packages will be copied to the current project.</p>
        <input type="text" placeholder="Source project ID (UUID)" value={sourceProjectId} onChange={(e) => setSourceProjectId(e.target.value)} className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={resetBudgetDates} onChange={(e) => setResetBudgetDates(e.target.checked)} />
          Reset budget and dates
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button type="button" onClick={handleCopy} disabled={loading || !sourceProjectId.trim()} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Copy
          </button>
        </div>
      </div>
    </div>
  )
}

export function BulkEditModal({
  projectId,
  wpIds,
  onClose,
  onSaved,
}: {
  projectId: string
  wpIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [responsible, setResponsible] = useState('')
  const [shiftDays, setShiftDays] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSave = async () => {
    setError(null)
    setLoading(true)
    try {
      for (const wpId of wpIds) {
        const body: Record<string, unknown> = {}
        if (responsible.trim()) body.responsible_manager = responsible.trim()
        if (shiftDays !== 0) {
          const wp = await projectControlsApi.listWorkPackages(projectId, false).then((arr) => (Array.isArray(arr) ? (arr as WorkPackage[]).find((w) => w.id === wpId) : null))
          if (wp?.start_date && wp?.end_date) {
            const d = (s: string) => new Date(s)
            const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
            body.start_date = addDays(d(wp.start_date), shiftDays)
            body.end_date = addDays(d(wp.end_date), shiftDays)
          }
        }
        if (Object.keys(body).length > 0) await projectControlsApi.updateWorkPackage(projectId, wpId, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-semibold">Bulk edit ({wpIds.length} work packages)</h4>
        <input type="text" placeholder="Set responsible (user ID)" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm" />
        <input type="number" placeholder="Shift dates (days)" value={shiftDays || ''} onChange={(e) => setShiftDays(Number(e.target.value) || 0)} className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm" />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={loading} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Apply
          </button>
        </div>
      </div>
    </div>
  )
}

export function ImportCsvModal({ projectId, onClose, onImported }: { projectId: string; onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleImport = async () => {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) { setError('Need header + at least one row'); return }
    const header = lines[0].toLowerCase().split(',').map((s) => s.trim())
    const nameIdx = header.findIndex((h) => h === 'name' || h === 'title')
    if (nameIdx < 0) { setError('CSV must have a "name" column'); return }
    const budgetIdx = header.findIndex((h) => h === 'budget')
    const startIdx = header.findIndex((h) => h === 'start_date' || h === 'start')
    const endIdx = header.findIndex((h) => h === 'end_date' || h === 'end')
    const respIdx = header.findIndex((h) => h === 'responsible' || h === 'responsible_manager')
    setError(null)
    setLoading(true)
    try {
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map((s) => s.trim())
        const name = cells[nameIdx] || `Imported ${i}`
        await projectControlsApi.createWorkPackage(projectId, {
          project_id: projectId,
          name,
          description: null,
          budget: budgetIdx >= 0 ? Number(cells[budgetIdx]) || 0 : 0,
          start_date: startIdx >= 0 && cells[startIdx] ? cells[startIdx].slice(0, 10) : new Date().toISOString().slice(0, 10),
          end_date: endIdx >= 0 && cells[endIdx] ? cells[endIdx].slice(0, 10) : new Date().toISOString().slice(0, 10),
          responsible_manager: respIdx >= 0 && cells[respIdx] ? cells[respIdx] : '',
        })
      }
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-semibold">Import CSV</h4>
        <p className="text-sm text-gray-600 dark:text-slate-400">Paste CSV with columns: name, budget (optional), start_date, end_date, responsible</p>
        <textarea rows={8} placeholder="name,budget,start_date,end_date,responsible&#10;WP 1,1000,2025-01-01,2025-06-30," value={csv} onChange={(e) => setCsv(e.target.value)} className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm font-mono" />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button type="button" onClick={handleImport} disabled={loading || !csv.trim()} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Apply
          </button>
        </div>
      </div>
    </div>
  )
}

const BUILTIN_TEMPLATES = [
  { id: 'phase-gates', name: 'Phase gates', items: [{ name: 'Initiation', budget: 0 }, { name: 'Planning', budget: 0 }, { name: 'Execution', budget: 0 }, { name: 'Closing', budget: 0 }] },
  { id: 'design-build', name: 'Design & Build', items: [{ name: 'Design', budget: 0 }, { name: 'Procurement', budget: 0 }, { name: 'Construction', budget: 0 }] },
]

export function ApplyTemplateModal({ projectId, onClose, onApplied }: { projectId: string; onClose: () => void; onApplied: () => void }) {
  const [selected, setSelected] = useState(BUILTIN_TEMPLATES[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleApply = async () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === selected)
    if (!t) return
    setError(null)
    setLoading(true)
    try {
      const base = new Date()
      for (let i = 0; i < t.items.length; i++) {
        const start = new Date(base)
        start.setMonth(start.getMonth() + i * 2)
        const end = new Date(start)
        end.setMonth(end.getMonth() + 2)
        await projectControlsApi.createWorkPackage(projectId, {
          project_id: projectId,
          name: t.items[i].name,
          description: null,
          budget: t.items[i].budget,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          responsible_manager: '',
        })
      }
      onApplied()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-semibold">Apply template</h4>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm">
          {BUILTIN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button type="button" onClick={handleApply} disabled={loading} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Apply
          </button>
        </div>
      </div>
    </div>
  )
}

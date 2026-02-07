'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/shared/AppLayout'
import { getApiUrl } from '@/lib/api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { Building2, ChevronRight, ChevronDown, Plus, Pencil, AlertTriangle } from 'lucide-react'

const ORG_TYPES = ['Company', 'Division', 'BusinessUnit', 'Country', 'Site'] as const

export interface OrgNode {
  id: string
  name: string
  code?: string
  slug?: string
  type?: string
  parent_id?: string | null
  path?: string | null
  depth?: number
  is_active: boolean
  created_at?: string
  children: OrgNode[]
}

function buildTree(flat: OrgNode[]): OrgNode[] {
  const byId = new Map<string, OrgNode>()
  flat.forEach((o) => byId.set(o.id, { ...o, children: [] }))
  const roots: OrgNode[] = []
  byId.forEach((node) => {
    const withChildren = node as OrgNode
    if (!node.parent_id) {
      roots.push(withChildren)
    } else {
      const parent = byId.get(node.parent_id)
      if (parent) (parent as OrgNode).children.push(withChildren)
      else roots.push(withChildren)
    }
  })
  roots.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  byId.forEach((n) => (n as OrgNode).children.sort((a, b) => (a.name || '').localeCompare(b.name || '')))
  return roots
}

function OrgTreeRow({
  node,
  level,
  expandedIds,
  onToggle,
  onEdit,
}: {
  node: OrgNode
  level: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (node: OrgNode) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)

  return (
    <div className="select-none" data-testid={`org-node-${node.id}`}>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className="p-0.5 rounded"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-slate-400" />
            )
          ) : (
            <span className="w-4 inline-block" />
          )}
        </button>
        <span className="font-medium text-gray-900 dark:text-slate-100">{node.name}</span>
        {node.type && (
          <span className="text-xs text-gray-500 dark:text-slate-400">({node.type})</span>
        )}
        {node.path != null && (
          <span className="text-xs text-gray-400 dark:text-slate-500">path: {node.path}</span>
        )}
        <button
          type="button"
          onClick={() => onEdit(node)}
          className="ml-auto p-1.5 rounded text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <OrgTreeRow
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OrgTree({ nodes, expandedIds, onToggle, onEdit }: {
  nodes: OrgNode[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (node: OrgNode) => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
      {nodes.map((node) => (
        <OrgTreeRow
          key={node.id}
          node={node}
          level={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

function AdminOrgsContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [tree, setTree] = useState<OrgNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<OrgNode | null>(null)
  const [parentOptions, setParentOptions] = useState<OrgNode[]>([])
  const [form, setForm] = useState({
    name: '',
    type: 'Company' as const,
    slug: '',
    parent_id: '' as string | null,
    is_active: true,
  })
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchList = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }
    setError(null)
    setForbidden(false)
    try {
      const res = await fetch(getApiUrl('/api/admin/organizations?hierarchy=1'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        setForbidden(true)
        setTree([])
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.details || data?.error || res.statusText)
        return
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setParentOptions(list)
      setTree(buildTree(list.map((o: Record<string, unknown>) => ({ ...o, children: [] }))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      type: 'Company',
      slug: '',
      parent_id: null,
      is_active: true,
    })
    setShowModal(true)
  }

  const openEdit = (node: OrgNode) => {
    setEditing(node)
    setForm({
      name: node.name,
      type: (node.type as typeof ORG_TYPES[number]) || 'Company',
      slug: node.slug ?? '',
      parent_id: node.parent_id ?? null,
      is_active: node.is_active,
    })
    setShowModal(true)
  }

  const submit = async () => {
    const token = session?.access_token
    if (!token) return
    setSubmitLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        slug: form.slug || undefined,
        is_active: form.is_active,
      }
      if (editing) {
        if (form.parent_id !== (editing.parent_id ?? null)) body.parent_id = form.parent_id || null
        const res = await fetch(getApiUrl(`/api/admin/organizations/${editing.id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.details || data?.error || res.statusText)
        }
      } else {
        if (form.parent_id) body.parent_id = form.parent_id
        const res = await fetch(getApiUrl('/api/admin/organizations'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.details || data?.error || res.statusText)
        }
      }
      setShowModal(false)
      fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="p-8" data-testid="admin-orgs-page">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="text-sm text-gray-600 dark:text-slate-400 hover:underline mb-2"
          >
            ← Admin
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            Organisations (Hierarchy)
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Tree view with path/ltree; edit parent to move in hierarchy.
          </p>
        </div>
        {!forbidden && !error && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> Add organisation
          </button>
        )}
      </div>

      {forbidden && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Access denied</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Only users with the <strong>super_admin</strong> role can manage organisations.
            </p>
          </div>
        </div>
      )}

      {error && !forbidden && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-500 dark:text-slate-400">Loading…</p>}

      {!loading && !forbidden && !error && (
        <OrgTree
          nodes={tree}
          expandedIds={expandedIds}
          onToggle={toggle}
          onEdit={openEdit}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editing ? 'Edit organisation' : 'New organisation'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Parent</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value || null }))}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                >
                  <option value="">— Root —</option>
                  {parentOptions
                    .filter((o) => !editing || o.id !== editing.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name} {o.path ? `(${o.path})` : ''}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Slug (optional)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2"
                  placeholder="acme-corp"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active_org"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <label htmlFor="is_active_org" className="text-sm text-gray-700 dark:text-slate-300">Active</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!form.name.trim() || submitLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {submitLoading ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminOrgsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-gray-500 dark:text-slate-400">Loading organisations…</div>}>
        <AdminOrgsContent />
      </Suspense>
    </AppLayout>
  )
}

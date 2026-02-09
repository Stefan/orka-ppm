'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/shared/AppLayout'
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Save,
  ArrowLeft,
  Layers,
} from 'lucide-react'
import type { Feature } from '@/types/features'
import { supabase } from '@/lib/api/supabase-minimal'
import Link from 'next/link'

export default function AdminFeaturesPage() {
  const router = useRouter()
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Feature>>({})
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('feature_catalog')
        .select('*')
        .order('name')
      if (!cancelled && !error && data) {
        setFeatures(data as Feature[])
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const startEdit = useCallback((f: Feature) => {
    setEditingId(f.id)
    setForm({
      name: f.name,
      parent_id: f.parent_id,
      description: f.description ?? undefined,
      screenshot_url: f.screenshot_url ?? undefined,
      link: f.link ?? undefined,
      icon: f.icon ?? undefined,
    })
  }, [])

  const startAdd = useCallback(() => {
    setEditingId('new')
    setForm({
      name: '',
      parent_id: null,
      description: '',
      screenshot_url: '',
      link: '',
      icon: 'BookOpen',
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setForm({})
  }, [])

  const save = useCallback(async () => {
    if (!form.name) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const { data, error } = await supabase
          .from('feature_catalog')
          .insert({
            name: form.name,
            parent_id: form.parent_id ?? null,
            description: form.description ?? null,
            screenshot_url: form.screenshot_url ?? null,
            link: form.link ?? null,
            icon: form.icon ?? null,
          })
          .select('id')
          .single()
        if (!error && data) {
          setFeatures((prev) => [...prev, { ...form, id: data.id } as Feature])
          cancelEdit()
        }
      } else if (editingId) {
        const { error } = await supabase
          .from('feature_catalog')
          .update({
            name: form.name,
            parent_id: form.parent_id ?? null,
            description: form.description ?? null,
            screenshot_url: form.screenshot_url ?? null,
            link: form.link ?? null,
            icon: form.icon ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
        if (!error) {
          setFeatures((prev) =>
            prev.map((f) =>
              f.id === editingId
                ? { ...f, ...form, updated_at: new Date().toISOString() }
                : f
            )
          )
          cancelEdit()
        }
      }
    } finally {
      setSaving(false)
    }
  }, [editingId, form, cancelEdit])

  const remove = useCallback(async (id: string) => {
    if (!window.confirm('Delete this feature?')) return
    const { error } = await supabase.from('feature_catalog').delete().eq('id', id)
    if (!error) setFeatures((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const suggestDescription = useCallback(async () => {
    if (!form.name) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/features/suggest-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, link: form.link ?? '' }),
      })
      if (res.ok) {
        const { description } = await res.json()
        setForm((prev) => ({ ...prev, description }))
      }
    } finally {
      setSuggesting(false)
    }
  }, [form.name, form.link])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div data-testid="admin-features-page" className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
              aria-label="Back to admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Layers className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Feature catalog</h1>
              <p className="text-sm text-gray-600 dark:text-slate-400">Add, edit, or delete features</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            data-testid="admin-features-add"
          >
            <Plus className="h-4 w-4" />
            Add feature
          </button>
        </div>

        {editingId && (
          <div className="mb-6 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm" data-testid="admin-features-form">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingId === 'new' ? 'New feature' : 'Edit feature'}
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Parent</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      parent_id: e.target.value || null,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                >
                  <option value="">— None (root) —</option>
                  {features
                    .filter((f) => f.id !== editingId)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                  <button
                    type="button"
                    onClick={suggestDescription}
                    disabled={suggesting || !form.name}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
                    data-testid="admin-features-suggest-description"
                  >
                    <Sparkles className="h-3 w-3" />
                    {suggesting ? '…' : 'Suggest'}
                  </button>
                </div>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Link</label>
                <input
                  type="text"
                  value={form.link ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                  placeholder="/financials"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Screenshot URL</label>
                <input
                  type="text"
                  value={form.screenshot_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, screenshot_url: e.target.value }))}
                  placeholder="https://… or /feature-screenshots/financials.png"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Icon (lucide name)</label>
                <input
                  type="text"
                  value={form.icon ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="Wallet, BookOpen, Upload"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.name}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Link</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Parent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {features.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{f.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{f.link ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {f.parent_id ? features.find((p) => p.id === f.parent_id)?.name ?? f.parent_id : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="rounded p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      className="rounded p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}

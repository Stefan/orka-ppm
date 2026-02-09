'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { useTranslations } from '@/lib/i18n/context'
import { FolderOpen, ArrowLeft, GitBranch, Loader2, Pencil, Trash2, X, BarChart3 } from 'lucide-react'
import { loadCriticalData, loadSecondaryData } from '@/lib/api/dashboard-loader'

interface PortfolioDetail {
  id: string
  name: string
  description?: string | null
  owner_id?: string | null
}

interface ProjectItem {
  id: string
  name: string
  status: string
  health?: string
  budget?: number
}

export default function PortfolioDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : null
  const { session, loading: authLoading } = useAuth()
  const { t } = useTranslations()
  const { portfolios, setPortfolios, currentPortfolioId, setCurrentPortfolioId } = usePortfolio()
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'dashboard'>('overview')
  const [dashboardStats, setDashboardStats] = useState<{ total_projects: number; active_projects: number; health_distribution: { green: number; yellow: number; red: number } } | null>(null)
  const [dashboardProjects, setDashboardProjects] = useState<ProjectItem[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/')
    }
  }, [authLoading, session, router])

  const loadData = useCallback(() => {
    if (!session?.access_token || !id) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/portfolios/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then((res) => {
        if (!res.ok) throw new Error('Portfolio not found')
        return res.json()
      }),
      fetch(`/api/projects?portfolio_id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then((res) => {
        if (!res.ok) return []
        return res.json().then((data) => Array.isArray(data) ? data : data?.projects ?? data?.items ?? [])
      }),
    ])
      .then(([portfolioData, projectsData]) => {
        setPortfolio(portfolioData)
        setProjects(projectsData)
        setEditName(portfolioData.name)
        setEditDescription(portfolioData.description ?? '')
      })
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [session?.access_token, id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openEdit = () => {
    if (portfolio) {
      setEditName(portfolio.name)
      setEditDescription(portfolio.description ?? '')
      setEditError(null)
      setEditOpen(true)
    }
  }

  const handleEdit = () => {
    if (!session?.access_token || !id) return
    setEditSubmitting(true)
    setEditError(null)
    fetch(`/api/portfolios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
    })
      .then((res) => {
        const body = res.json()
        if (!res.ok) return body.then((o: { error?: string }) => { throw new Error(o?.error ?? 'Failed to update') })
        return body
      })
      .then((updated) => {
        setPortfolio(updated)
        setPortfolios(portfolios.map((p) => (p.id === id ? { ...p, name: updated.name, description: updated.description } : p)))
        setEditOpen(false)
      })
      .catch((err) => setEditError(err?.message ?? 'Failed to update'))
      .finally(() => setEditSubmitting(false))
  }

  useEffect(() => {
    if (activeTab !== 'dashboard' || !session?.access_token || !id) return
    setDashboardLoading(true)
    Promise.all([
      loadCriticalData(session.access_token, { portfolioId: id }),
      loadSecondaryData(session.access_token, 10, { portfolioId: id }),
    ])
      .then(([critical, projList]) => {
        setDashboardStats(critical.quickStats)
        setDashboardProjects((projList ?? []).map((p: { id: string; name: string; status: string; health?: string; budget?: number }) => ({ id: p.id, name: p.name, status: p.status, health: p.health, budget: p.budget })))
      })
      .catch(() => {})
      .finally(() => setDashboardLoading(false))
  }, [activeTab, session?.access_token, id])

  const handleDelete = () => {
    if (!session?.access_token || !id) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    fetch(`/api/portfolios/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => {
        if (res.status === 409) return res.json().then((o: { error?: string }) => { throw new Error(o?.error ?? t('portfolios.deleteBlocked')) })
        if (!res.ok) return res.json().then((o: { error?: string }) => { throw new Error(o?.error ?? 'Failed to delete') })
      })
      .then(() => {
        setPortfolios(portfolios.filter((p) => p.id !== id))
        if (currentPortfolioId === id) setCurrentPortfolioId(null)
        router.push('/portfolios')
      })
      .catch((err) => setDeleteError(err?.message ?? 'Failed to delete'))
      .finally(() => setDeleteSubmitting(false))
  }

  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  if (!id) {
    return (
      <AppLayout>
        <div className="p-8">
          <p className="text-gray-600 dark:text-slate-400">Invalid portfolio.</p>
          <Link href="/portfolios" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            ← {t('nav.portfolios')}
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/portfolios"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('nav.portfolios')}
          </Link>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : !portfolio ? (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
              <p className="text-gray-600 dark:text-slate-400">Portfolio not found.</p>
              <Link href="/portfolios" className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
                ← Back to portfolios
              </Link>
            </div>
          ) : (
            <>
              <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    <FolderOpen className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                      {portfolio.name}
                    </h1>
                    {portfolio.description && (
                      <p className="text-gray-600 dark:text-slate-400 mt-1">
                        {portfolio.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                    {t('portfolios.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setDeleteConfirmOpen(true) }}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('portfolios.delete')}
                  </button>
                </div>
              </header>

              {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-portfolio-title">
                  <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 id="edit-portfolio-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('portfolios.editTitle')}</h2>
                      <button type="button" onClick={() => setEditOpen(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700" aria-label={t('portfolios.cancel')}>
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {editError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{editError}</p>}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('portfolios.nameLabel')}</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100" />
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('portfolios.descriptionLabel')}</label>
                      <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-slate-100" />
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                      <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">{t('portfolios.cancel')}</button>
                      <button type="button" onClick={handleEdit} disabled={editSubmitting || !editName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600">{editSubmitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} {t('portfolios.save')}</button>
                    </div>
                  </div>
                </div>
              )}

              {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-portfolio-title">
                  <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                    <h2 id="delete-portfolio-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">{t('portfolios.delete')}</h2>
                    <p className="text-gray-600 dark:text-slate-400 mb-4">{t('portfolios.deleteConfirm')}</p>
                    {deleteError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteError(null) }} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">{t('portfolios.cancel')}</button>
                      <button type="button" onClick={handleDelete} disabled={deleteSubmitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600">{deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : null} {t('portfolios.delete')}</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'}`}
                >
                  {t('portfolios.tabOverview')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'}`}
                >
                  <BarChart3 className="h-4 w-4" />
                  {t('portfolios.tabDashboard')}
                </button>
              </div>

              {activeTab === 'overview' && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  {t('portfolios.projectsInPortfolio')}
                </h2>
                {projects.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
                    <GitBranch className="h-10 w-10 mx-auto text-gray-400 dark:text-slate-500 mb-2" />
                    <p className="text-gray-600 dark:text-slate-400">
                      {t('portfolios.noProjects')}
                    </p>
                    <Link
                      href="/projects"
                      className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('nav.allProjects')}
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {projects.map((proj) => (
                      <li key={proj.id}>
                        <Link
                          href={`/projects/${proj.id}`}
                          className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <GitBranch className="h-5 w-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                              {proj.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {proj.status}
                              {proj.health && ` · ${proj.health}`}
                              {proj.budget != null && ` · Budget ${proj.budget}`}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-slate-400">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              )}

              {activeTab === 'dashboard' && (
                <section>
                  {dashboardLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <>
                      {dashboardStats && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                            <p className="text-sm text-gray-500 dark:text-slate-400">{t('dashboard.projects')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{dashboardStats.total_projects}</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                            <p className="text-sm text-gray-500 dark:text-slate-400">{t('stats.activeProjects', 'Active')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{dashboardStats.active_projects}</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                            <p className="text-sm text-gray-500 dark:text-slate-400">Health: Green</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dashboardStats.health_distribution?.green ?? 0}</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                            <p className="text-sm text-gray-500 dark:text-slate-400">At risk / Red</p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{(dashboardStats.health_distribution?.yellow ?? 0) + (dashboardStats.health_distribution?.red ?? 0)}</p>
                          </div>
                        </div>
                      )}
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{t('portfolios.projectsInPortfolio')}</h2>
                      {dashboardProjects.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
                          <GitBranch className="h-10 w-10 mx-auto text-gray-400 dark:text-slate-500 mb-2" />
                          <p className="text-gray-600 dark:text-slate-400">{t('portfolios.noProjects')}</p>
                          <Link href="/projects" className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline">{t('nav.allProjects')}</Link>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {dashboardProjects.map((proj) => (
                            <li key={proj.id}>
                              <Link href={`/projects/${proj.id}`} className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <GitBranch className="h-5 w-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{proj.name}</p>
                                  <p className="text-sm text-gray-500 dark:text-slate-400">{proj.status}{proj.health ? ` · ${proj.health}` : ''}{proj.budget != null ? ` · Budget ${proj.budget}` : ''}</p>
                                </div>
                                <span className="text-sm text-gray-500 dark:text-slate-400">→</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { FolderOpen, ArrowLeft, GitBranch, Loader2 } from 'lucide-react'

interface PortfolioDetail {
  id: string
  name: string
  description?: string | null
  owner_id: string
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
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/')
    }
  }, [authLoading, session, router])

  useEffect(() => {
    if (!session?.access_token || !id) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/portfolios/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((res) => {
        if (!res.ok) throw new Error('Portfolio not found')
        return res.json()
      }),
      fetch(`/api/projects?portfolio_id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((res) => {
        if (!res.ok) return []
        return res.json().then((data) => Array.isArray(data) ? data : data?.projects ?? data?.items ?? [])
      }),
    ])
      .then(([portfolioData, projectsData]) => {
        setPortfolio(portfolioData)
        setProjects(projectsData)
      })
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [session?.access_token, id])

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
              <header className="mb-8">
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
              </header>

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
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

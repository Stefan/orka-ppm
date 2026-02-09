'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { usePortfolio, type Portfolio } from '@/contexts/PortfolioContext'
import { useTranslations } from '@/lib/i18n/context'
import { FolderOpen, ChevronRight, Loader2 } from 'lucide-react'

export default function PortfoliosPage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const { portfolios, setPortfolios } = usePortfolio()
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/')
    }
  }, [authLoading, session, router])

  useEffect(() => {
    if (!session?.access_token) return
    setLoading(true)
    setError(null)
    fetch('/api/portfolios', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch portfolios')
        return res.json()
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.portfolios ?? []
        setPortfolios(
          list.map((p: { id: string; name: string; description?: string; owner_id: string }) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            owner_id: p.owner_id,
          }))
        )
      })
      .catch(() => setError(t('portfolios.loadError')))
      .finally(() => setLoading(false))
  }, [session?.access_token, setPortfolios, t])

  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {t('nav.portfolios')}
            </h1>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              {t('portfolios.pageDescription')}
            </p>
          </header>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : portfolios.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-gray-400 dark:text-slate-500 mb-4" />
              <p className="text-gray-600 dark:text-slate-400">
                {t('portfolios.empty')}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {portfolios.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/portfolios/${p.id}`}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {p.name}
                      </p>
                      {p.description && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

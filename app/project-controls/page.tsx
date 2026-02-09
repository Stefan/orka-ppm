'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { debugIngest } from '@/lib/debug-ingest'
import { ResponsiveContainer } from '@/components/ui/molecules/ResponsiveContainer'
import ProjectControlsDashboard from '@/components/project-controls/ProjectControlsDashboard'

export default function ProjectControlsPage() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const initialTab = searchParams.get('tab') === 'work-packages' ? 'work-packages' : undefined
  const headerRef = useRef<HTMLDivElement>(null)

  // #region agent log
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof window === 'undefined') return
    const clientWidth = el.clientWidth
    debugIngest({ location: 'project-controls/page.tsx:header', message: 'controls_header_width', data: { clientWidth, innerWidth: window.innerWidth }, hypothesisId: 'H2' })
  }, [])
  // #endregion

  useEffect(() => {
    const load = async () => {
      try {
        const { apiRequest } = await import('@/lib/api/client')
        const data = await apiRequest('/projects')
        const list = Array.isArray(data) ? data : (data?.projects ?? [])
        setProjects(list.slice(0, 20).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
        if (list.length > 0) {
          const fromUrl = searchParams.get('project')
          setSelectedProjectId((prev) => prev ?? (fromUrl && list.some((p: { id: string }) => p.id === fromUrl) ? fromUrl : list[0].id)
        }
      } catch {
        setProjects([])
      }
    }
    load()
  }, [searchParams])

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="min-w-0 overflow-x-hidden">
        <div className="space-y-4 min-w-0" ref={headerRef}>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('projectControlsPage.title')}</h1>
            <p className="text-gray-600 dark:text-slate-400 mt-1">{t('projectControlsPage.subtitle')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('projectControlsPage.projectLabel')}</label>
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">{t('projectControlsPage.selectProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {selectedProjectId && (
            <ProjectControlsDashboard projectId={selectedProjectId} initialTab={initialTab} />
          )}
        </div>
      </ResponsiveContainer>
    </AppLayout>
  )
}

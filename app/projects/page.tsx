'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import WorkflowStatusBadge from '@/components/workflow/WorkflowStatusBadge'
import WorkflowApprovalModal from '@/components/workflow/WorkflowApprovalModal'
import { getApiUrl } from '@/lib/api'
import ShareButton from '@/components/projects/ShareButton'
import ProjectActionButtons from '@/components/projects/ProjectActionButtons'
import ProjectImportModal from '@/components/projects/ProjectImportModal'
import { Upload } from 'lucide-react'
import { useWorkflowNotifications } from '@/hooks/useWorkflowRealtime'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { useProjectsQuery, useInvalidateProjects, type ProjectListItem } from '@/lib/projects-queries'

type Project = ProjectListItem & { description?: string }

export default function ProjectsPage() {
  const router = useRouter()
  const { t } = useTranslations()
  const { session, loading: authLoading } = useAuth()
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)

  const currentUserId = session?.user?.id ?? undefined
  const accessToken = session?.access_token ?? undefined
  const { currentPortfolioId } = usePortfolio()
  const { data: projectsData, isLoading: loading, error: queryError, refetch } = useProjectsQuery(accessToken, currentUserId, currentPortfolioId)
  const invalidateProjects = useInvalidateProjects()
  const projects: Project[] = (projectsData ?? []).map((p) => ({ ...p, description: p.description ?? '' }))
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'An error occurred') : null

  const { subscribe } = useWorkflowNotifications(currentUserId ?? null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/')
    }
  }, [authLoading, session, router])

  useEffect(() => {
    if (session) {
      fetchUserPermissions()
    }
  }, [session])

  useEffect(() => {
    if (currentUserId) {
      subscribe((payload) => {
        const notificationData = payload.new
        if (notificationData.type === 'approval_required' ||
            notificationData.type === 'workflow_completed' ||
            notificationData.type === 'workflow_rejected') {
          setNotification(`Workflow notification: ${notificationData.type}`)
          invalidateProjects()
          setTimeout(() => setNotification(null), 5000)
        }
      })
    }
  }, [currentUserId, subscribe, invalidateProjects])

  const fetchUserPermissions = async () => {
    try {
      if (!session?.access_token) return

      const response = await fetch(getApiUrl('/api/rbac/user-permissions'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUserPermissions(data.permissions || [])
      }
    } catch (err) {
      // Silently fail - permissions are optional for viewing projects
      console.warn('Could not fetch user permissions (backend may not be running):', err)
    }
  }

  const handleWorkflowClick = (workflowInstanceId: string) => {
    setSelectedWorkflow(workflowInstanceId)
  }

  const handleWorkflowClose = () => {
    setSelectedWorkflow(null)
    invalidateProjects()
  }

  // Show loading while checking auth
  if (authLoading || !session) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-8"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    const retryMessage = (error.includes('fetch') || error.includes('Failed to fetch'))
      ? 'Backend unavailable. Check your connection or try again later.'
      : error
    return (
      <AppLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-300">{retryMessage}</p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div data-testid="projects-page" className="p-8">
        <div className="max-w-7xl mx-auto">
          <div data-testid="projects-header" className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 data-testid="projects-title" className="text-3xl font-bold text-gray-900 dark:text-slate-100">{t('projects.title')}</h1>
              <p className="text-gray-700 dark:text-slate-300 mt-2">{t('projects.pageDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              data-testid="projects-import-button"
            >
              <Upload className="h-4 w-4" />
              {t('projects.import')}
            </button>
          </div>
          <ProjectImportModal
            isOpen={importModalOpen}
            onClose={() => { setImportModalOpen(false); invalidateProjects() }}
            portfolioId={currentPortfolioId ?? undefined}
          />

          {/* Realtime Notification Banner */}
          {notification && (
            <div data-testid="projects-notification" className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
              <p className="text-blue-800 dark:text-blue-300">{notification}</p>
              <button
                onClick={() => setNotification(null)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Dismiss
              </button>
            </div>
          )}

          <Suspense
            fallback={
              <div data-testid="projects-list" className="space-y-4">
                <div className="space-y-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 animate-pulse">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div>
                        </div>
                        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-16"></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }, (_, j) => (
                          <div key={j} className="text-center">
                            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full mb-1"></div>
                            <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mx-auto"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            <div data-testid="projects-list" className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {/* Loading skeleton */}
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 animate-pulse">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div>
                        </div>
                        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-16"></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }, (_, j) => (
                          <div key={j} className="text-center">
                            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full mb-1"></div>
                            <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mx-auto"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div data-testid="projects-empty" className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
                  <p className="text-gray-600 dark:text-slate-400">No projects found</p>
                </div>
              ) : (
                projects.map((project) => (
                <div
                  key={project.id}
                  data-testid="project-card"
                  className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                          {project.name}
                        </h2>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          project.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          project.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                          project.status === 'planning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 dark:text-slate-300 mb-4">{project.description}</p>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-slate-400">
                        <div>
                          <span className="font-medium">Start:</span> {project.start_date}
                        </div>
                        <div>
                          <span className="font-medium">End:</span> {project.end_date}
                        </div>
                        <div>
                          <span className="font-medium">Budget:</span> ${(project.budget ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="ml-6 flex items-center gap-2">
                      {/* Project Action Buttons with RBAC */}
                      <ProjectActionButtons
                        projectId={project.id}
                        onEdit={() => router.push(`/projects/${project.id}`)}
                        onBudgetUpdate={() => router.push(`/financials`)}
                        onResourceManage={() => router.push(`/resources`)}
                        onReportGenerate={() => router.push(`/reports`)}
                        variant="compact"
                      />

                      {/* Share Button */}
                      <ShareButton
                        projectId={project.id}
                        projectName={project.name}
                        userPermissions={userPermissions}
                        variant="secondary"
                        size="sm"
                      />

                      {project.workflow_instance && (
                        <WorkflowStatusBadge
                          status={project.workflow_instance.status}
                          currentStep={project.workflow_instance.current_step}
                          workflowName={project.workflow_instance.workflow_name}
                          pendingApprovals={project.workflow_instance.pending_approvals}
                          onClick={() => handleWorkflowClick(project.workflow_instance!.id)}
                        />
                      )}
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </Suspense>
        </div>

        {selectedWorkflow && (
          <WorkflowApprovalModal
            workflowInstanceId={selectedWorkflow}
            onClose={handleWorkflowClose}
          />
        )}
      </div>
    </AppLayout>
  )
}

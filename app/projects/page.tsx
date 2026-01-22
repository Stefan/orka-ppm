'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import WorkflowStatusBadge from '@/components/workflow/WorkflowStatusBadge'
import WorkflowApprovalModal from '@/components/workflow/WorkflowApprovalModal'
import ShareButton from '@/components/projects/ShareButton'
import ProjectActionButtons from '@/components/projects/ProjectActionButtons'
import { useWorkflowNotifications } from '@/hooks/useWorkflowRealtime'

interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  end_date: string
  budget: number
  workflow_instance?: {
    id: string
    status: string
    current_step: number
    workflow_name: string
    pending_approvals: number
  }
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [userPermissions, setUserPermissions] = useState<string[]>([])

  const { subscribe } = useWorkflowNotifications(currentUserId)

  useEffect(() => {
    fetchProjects()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUserId) {
      subscribe((payload) => {
        const notificationData = payload.new
        if (notificationData.type === 'approval_required' || 
            notificationData.type === 'workflow_completed' ||
            notificationData.type === 'workflow_rejected') {
          setNotification(`Workflow notification: ${notificationData.type}`)
          // Refresh projects to show updated workflow status
          fetchProjects()
          
          // Clear notification after 5 seconds
          setTimeout(() => setNotification(null), 5000)
        }
      })
    }
  }, [currentUserId, subscribe])

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentUserId(data.user_id)
        setUserPermissions(data.permissions || [])
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err)
    }
  }

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }

      const data = await response.json()
      setProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowClick = (workflowInstanceId: string) => {
    setSelectedWorkflow(workflowInstanceId)
  }

  const handleWorkflowClose = () => {
    setSelectedWorkflow(null)
    // Refresh projects to get updated workflow status
    fetchProjects()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchProjects}
              className="mt-2 text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your projects and workflow approvals</p>
        </div>

        {/* Realtime Notification Banner */}
        {notification && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-blue-800">{notification}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No projects found</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {project.name}
                      </h2>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        project.status === 'active' ? 'bg-green-100 text-green-800' :
                        project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{project.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div>
                        <span className="font-medium">Start:</span> {project.start_date}
                      </div>
                      <div>
                        <span className="font-medium">End:</span> {project.end_date}
                      </div>
                      <div>
                        <span className="font-medium">Budget:</span> ${project.budget.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="ml-6 flex items-center gap-2">
                    {/* Project Action Buttons with RBAC */}
                    <ProjectActionButtons
                      projectId={project.id}
                      onEdit={() => router.push(`/projects/${project.id}/edit`)}
                      onBudgetUpdate={() => router.push(`/projects/${project.id}/budget`)}
                      onResourceManage={() => router.push(`/projects/${project.id}/resources`)}
                      onReportGenerate={() => router.push(`/projects/${project.id}/reports`)}
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
      </div>

      {selectedWorkflow && (
        <WorkflowApprovalModal
          workflowInstanceId={selectedWorkflow}
          onClose={handleWorkflowClose}
        />
      )}
    </div>
  )
}

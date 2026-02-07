/**
 * Project Detail Page
 * 
 * Displays detailed project information with share link management.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import ShareLinkManager from '@/components/projects/ShareLinkManager'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  end_date: string
  budget: number
  progress_percentage?: number
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'shares'>('overview')

  useEffect(() => {
    if (projectId) {
      fetchProject()
      fetchCurrentUser()
    }
  }, [projectId])

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
        setUserPermissions(data.permissions || [])
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err)
    }
  }

  const fetchProject = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }

      const data = await response.json()
      setProject(data.project || data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300">{error || 'Project not found'}</p>
            <button
              onClick={() => router.push('/projects')}
              className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/projects')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{project.name}</h1>
              <p className="text-gray-600 dark:text-slate-400 mt-2">{project.description}</p>
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              project.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
              project.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
              project.status === 'planning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
              'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
            }`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('shares')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'shares'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
              }`}
            >
              <Share2 className="h-4 w-4" />
              Share Links
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Project Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Start Date
                    </label>
                    <p className="text-gray-900 dark:text-slate-100">{project.start_date}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      End Date
                    </label>
                    <p className="text-gray-900 dark:text-slate-100">{project.end_date}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Budget
                    </label>
                    <p className="text-gray-900 dark:text-slate-100">${project.budget.toLocaleString()}</p>
                  </div>
                  {project.progress_percentage !== undefined && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Progress
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${project.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {project.progress_percentage}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'shares' && (
          <ShareLinkManager
            projectId={projectId}
            projectName={project.name}
            userPermissions={userPermissions}
          />
        )}
      </div>
    </div>
  )
}

/**
 * GuestProjectView Component
 * 
 * Displays project information for external stakeholders accessing via share link.
 * Provides a clean, branded view without system navigation elements.
 * Implements permission-based content rendering and mobile-optimized layout.
 */

'use client'

import React from 'react'
import { Calendar, Users, FileText, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/design-system'
import type { FilteredProjectData, SharePermissionLevel } from '@/types/share-links'

interface GuestProjectViewProps {
  projectData: FilteredProjectData
  permissionLevel: SharePermissionLevel
  customMessage?: string
}

/**
 * GuestProjectView Component
 */
export const GuestProjectView: React.FC<GuestProjectViewProps> = ({
  projectData,
  permissionLevel,
  customMessage
}) => {
  /**
   * Format date for display
   */
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      planning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      on_hold: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200',
      at_risk: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    }
    return statusColors[status.toLowerCase()] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
  }

  /**
   * Get milestone status icon
   */
  const getMilestoneIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'at_risk':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      default:
        return <Clock className="h-5 w-5 text-gray-400 dark:text-slate-500" />
    }
  }

  /**
   * Format file size
   */
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {projectData.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Shared Project View
                </p>
              </div>
            </div>
            <span className={cn(
              'px-3 py-1 text-sm font-medium rounded-full',
              getStatusColor(projectData.status)
            )}>
              {projectData.status}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Custom Message */}
        {customMessage && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Message from project manager:</span> {customMessage}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Project Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {projectData.description && (
                  <p className="text-gray-700 dark:text-slate-300 mb-6">
                    {projectData.description}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 dark:text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Start Date</p>
                      <p className="text-sm text-gray-900 dark:text-slate-100">{formatDate(projectData.start_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 dark:text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">End Date</p>
                      <p className="text-sm text-gray-900 dark:text-slate-100">{formatDate(projectData.end_date)}</p>
                    </div>
                  </div>
                </div>

                {projectData.progress_percentage !== undefined && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Progress</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {projectData.progress_percentage}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${projectData.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Milestones - LIMITED_DATA and FULL_PROJECT only */}
            {(permissionLevel === 'limited_data' || permissionLevel === 'full_project') && projectData.milestones && (
              <Card>
                <CardHeader>
                  <CardTitle>Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projectData.milestones.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        No milestones available
                      </p>
                    ) : (
                      projectData.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          {getMilestoneIcon(milestone.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {milestone.name}
                              </h4>
                              <span className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap',
                                getStatusColor(milestone.status)
                              )}>
                                {milestone.status}
                              </span>
                            </div>
                            {milestone.description && (
                              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                {milestone.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              Due: {formatDate(milestone.due_date)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline - LIMITED_DATA and FULL_PROJECT only */}
            {(permissionLevel === 'limited_data' || permissionLevel === 'full_project') && projectData.timeline && (
              <Card>
                <CardHeader>
                  <CardTitle>Project Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projectData.timeline.phases.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        No timeline phases available
                      </p>
                    ) : (
                      projectData.timeline.phases.map((phase, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {phase.name}
                              </h4>
                              <span className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded-full',
                                getStatusColor(phase.status)
                              )}>
                                {phase.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              {formatDate(phase.start_date)} - {formatDate(phase.end_date)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Team Members - LIMITED_DATA and FULL_PROJECT only */}
            {(permissionLevel === 'limited_data' || permissionLevel === 'full_project') && projectData.team_members && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projectData.team_members.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        No team members listed
                      </p>
                    ) : (
                      projectData.team_members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                              {member.role}
                            </p>
                            {member.email && (
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                                {member.email}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents - LIMITED_DATA and FULL_PROJECT only */}
            {(permissionLevel === 'limited_data' || permissionLevel === 'full_project') && projectData.documents && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {projectData.documents.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        No documents available
                      </p>
                    ) : (
                      projectData.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                              {doc.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                              <span>{doc.type}</span>
                              <span>•</span>
                              <span>{formatFileSize(doc.size)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Access Info */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:border-blue-800">
              <CardContent className="py-4">
                <div className="text-center">
                  <p className="text-xs font-medium text-blue-900 mb-1">
                    Access Level
                  </p>
                  <p className="text-sm font-semibold text-blue-700">
                    {permissionLevel === 'view_only' && 'View Only'}
                    {permissionLevel === 'limited_data' && 'Limited Data'}
                    {permissionLevel === 'full_project' && 'Full Project'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    {permissionLevel === 'view_only' && 'Basic project information'}
                    {permissionLevel === 'limited_data' && 'Milestones, timeline & documents'}
                    {permissionLevel === 'full_project' && 'Comprehensive project data'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            This is a shared project view. For questions or extended access, please contact the project manager.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default GuestProjectView

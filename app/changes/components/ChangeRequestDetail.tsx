'use client'

import { useState } from 'react'
import { ArrowLeft, Edit, Download, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, FileText, User, Calendar, DollarSign, Activity, Eye, Send, Upload } from 'lucide-react'
import { ChangeRequest, mockDataService } from '../lib/mockData'
import { useAsyncData, LoadingState } from '../lib/loadingStates'

interface ChangeRequestDetailProps {
  changeId: string
  onEdit: () => void
  onBack: () => void
}

export default function ChangeRequestDetail({ 
  changeId, 
  onEdit, 
  onBack 
}: ChangeRequestDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'approvals' | 'documents' | 'communications'>('overview')
  const [newComment, setNewComment] = useState('')

  // Use enhanced async data loading with loading states
  const {
    data: changeRequest,
    isLoading,
    isError,
    error,
    refetch
  } = useAsyncData<ChangeRequest>(
    () => Promise.resolve(mockDataService.getChangeRequest(changeId)),
    [changeId]
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-5 w-5 text-gray-500" data-testid="status-icon" />
      case 'submitted':
      case 'under_review':
        return <Clock className="h-5 w-5 text-yellow-500" data-testid="status-icon" />
      case 'pending_approval':
        return <AlertCircle className="h-5 w-5 text-orange-500" data-testid="status-icon" />
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" data-testid="status-icon" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" data-testid="status-icon" />
      case 'implementing':
        return <Activity className="h-5 w-5 text-blue-500" data-testid="status-icon" />
      case 'implemented':
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-green-600" data-testid="status-icon" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" data-testid="status-icon" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-gray-100 text-gray-800'
      case 'medium':
        return 'bg-blue-100 text-blue-800'
      case 'high':
        return 'bg-yellow-100 text-yellow-800'
      case 'critical':
        return 'bg-orange-100 text-orange-800'
      case 'emergency':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    
    // Add comment logic here
    console.log('Adding comment:', newComment)
    setNewComment('')
    // Refresh data after adding comment
    refetch()
  }

  return (
    <LoadingState
      state={isLoading ? 'loading' : isError ? 'error' : changeRequest ? 'success' : 'error'}
      message="Loading change request details..."
      error={error || (!changeRequest ? 'Change request not found' : undefined)}
      fallback={
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Change request not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The requested change request could not be loaded.
          </p>
          <div className="mt-6">
            <button
              onClick={onBack}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      }
    >
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {changeRequest.change_number}
                </h1>
                <p className="text-gray-600">{changeRequest.title}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(changeRequest.status)}
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {changeRequest.status.replace('_', ' ')}
                </span>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(changeRequest.priority)}`}>
                {changeRequest.priority}
              </span>
              <button
                onClick={onEdit}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'approvals', label: 'Approvals', icon: CheckCircle },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'communications', label: 'Communications', icon: MessageSquare }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Details */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Description</h3>
                    <p className="text-gray-700 leading-relaxed">{changeRequest.description}</p>
                  </div>

                  {changeRequest.justification && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Justification</h3>
                      <p className="text-gray-700 leading-relaxed">{changeRequest.justification}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Impact Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {changeRequest.estimated_cost_impact && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-gray-900">Cost Impact</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            ${changeRequest.estimated_cost_impact.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">Estimated</p>
                        </div>
                      )}

                      {changeRequest.estimated_schedule_impact_days && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-gray-900">Schedule Impact</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {changeRequest.estimated_schedule_impact_days} days
                          </p>
                          <p className="text-sm text-gray-600">Estimated delay</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Project Linkages */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Project Linkages</h3>
                    <div className="space-y-4">
                      {changeRequest.affected_milestones.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Affected Milestones</h4>
                          <div className="flex flex-wrap gap-2">
                            {changeRequest.affected_milestones.map(milestone => (
                              <span
                                key={milestone.id}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                              >
                                <LinkIcon className="h-3 w-3" />
                                {milestone.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {changeRequest.affected_pos.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Affected Purchase Orders</h4>
                          <div className="space-y-2">
                            {changeRequest.affected_pos.map(po => (
                              <div
                                key={po.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                              >
                                <LinkIcon className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-gray-900">{po.number}</span>
                                <span className="text-gray-600">- {po.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-3">Request Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Requested by:</span>
                        <span className="font-medium">{changeRequest.requested_by}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Requested:</span>
                        <span className="font-medium">
                          {new Date(changeRequest.requested_date).toLocaleDateString()}
                        </span>
                      </div>
                      {changeRequest.required_by_date && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600">Required by:</span>
                          <span className="font-medium">
                            {new Date(changeRequest.required_by_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium capitalize">{changeRequest.change_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-3">Project</h3>
                    <p className="text-sm font-medium text-blue-600">{changeRequest.project_name}</p>
                  </div>

                  {changeRequest.implementation_progress !== undefined && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-3">Implementation Progress</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{changeRequest.implementation_progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={changeRequest.implementation_progress} aria-valuemin={0} aria-valuemax={100}>
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${changeRequest.implementation_progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Change Request Timeline</h3>
              <div className="flow-root">
                <ul className="-mb-8">
                  {changeRequest.communications.map((comm, index) => (
                    <li key={comm.id}>
                      <div className="relative pb-8">
                        {index !== changeRequest.communications.length - 1 && (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                              {comm.type === 'comment' && <MessageSquare className="h-4 w-4 text-white" />}
                              {comm.type === 'status_change' && <Activity className="h-4 w-4 text-white" />}
                              {comm.type === 'approval' && <CheckCircle className="h-4 w-4 text-white" />}
                              {comm.type === 'notification' && <AlertCircle className="h-4 w-4 text-white" />}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{comm.author}</span>{' '}
                                {comm.message}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {new Date(comm.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Approvals Tab */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Approvals</h3>
                {changeRequest.pending_approvals.length > 0 ? (
                  <div className="space-y-3">
                    {changeRequest.pending_approvals.map(approval => (
                      <div key={approval.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              Step {approval.step_number}: {approval.approver_name}
                            </p>
                            <p className="text-sm text-gray-600 capitalize">
                              Status: {approval.status}
                            </p>
                          </div>
                          {approval.due_date && (
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Due Date</p>
                              <p className="font-medium text-gray-900">
                                {new Date(approval.due_date).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No pending approvals</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Approval History</h3>
                {changeRequest.approval_history.length > 0 ? (
                  <div className="space-y-3">
                    {changeRequest.approval_history.map(approval => (
                      <div key={approval.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{approval.approver_name}</p>
                            <p className="text-sm text-gray-600 capitalize">
                              Decision: <span className="font-medium">{approval.decision}</span>
                            </p>
                            {approval.comments && (
                              <p className="text-sm text-gray-700 mt-2">{approval.comments}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              {new Date(approval.decision_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No approval history</p>
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Attachments</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Document
                </button>
              </div>
              
              {changeRequest.attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {changeRequest.attachments.map(attachment => (
                    <div key={attachment.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {attachment.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.size)}
                            </p>
                            <p className="text-xs text-gray-500">
                              By {attachment.uploaded_by}
                            </p>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload documents to support this change request.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'communications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Comment</h3>
                <div className="space-y-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add a comment..."
                  />
                  <button
                    onClick={handleAddComment}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Add Comment
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Communication History</h3>
                <div className="space-y-4">
                  {changeRequest.communications.map(comm => (
                    <div key={comm.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">{comm.author}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              comm.type === 'comment' ? 'bg-blue-100 text-blue-800' :
                              comm.type === 'status_change' ? 'bg-yellow-100 text-yellow-800' :
                              comm.type === 'approval' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comm.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-gray-700">{comm.message}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(comm.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </LoadingState>
  )
}
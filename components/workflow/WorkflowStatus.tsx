'use client'

import { CheckCircle, XCircle, Clock, AlertCircle, ArrowRight, User } from 'lucide-react'

interface WorkflowApproval {
  id: string
  approver_id: string
  status: string
  comments: string | null
  approved_at: string | null
}

interface WorkflowInstance {
  id: string
  workflow_id: string
  workflow_name: string
  entity_type: string
  entity_id: string
  current_step: number
  status: string
  started_by: string
  started_at: string
  completed_at: string | null
  approvals: Record<number, WorkflowApproval[]>
  created_at: string
  updated_at: string
}

interface WorkflowStatusProps {
  workflowInstance: WorkflowInstance
  showDetails?: boolean
}

export default function WorkflowStatus({ 
  workflowInstance, 
  showDetails = false 
}: WorkflowStatusProps) {
  const getStatusConfig = () => {
    switch (workflowInstance.status) {
      case 'pending':
        return {
          icon: Clock,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-300',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          label: 'Pending Approval',
          description: 'Waiting for approvers to review'
        }
      case 'in_progress':
        return {
          icon: Clock,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-300',
          iconColor: 'text-blue-600 dark:text-blue-400',
          label: 'In Progress',
          description: 'Approval process is ongoing'
        }
      case 'completed':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-300',
          iconColor: 'text-green-600 dark:text-green-400',
          label: 'Approved',
          description: 'All approvals completed successfully'
        }
      case 'rejected':
        return {
          icon: XCircle,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-300',
          iconColor: 'text-red-600 dark:text-red-400',
          label: 'Rejected',
          description: 'Workflow was rejected'
        }
      default:
        return {
          icon: AlertCircle,
          bgColor: 'bg-gray-50 dark:bg-slate-800/50',
          borderColor: 'border-gray-200 dark:border-slate-700',
          textColor: 'text-gray-800 dark:text-slate-200',
          iconColor: 'text-gray-600 dark:text-slate-400',
          label: 'Unknown',
          description: 'Status unknown'
        }
    }
  }

  const getTotalSteps = () => {
    return Object.keys(workflowInstance.approvals).length
  }

  const getStepStatus = (stepNumber: number) => {
    const approvals = workflowInstance.approvals[stepNumber] || []
    
    if (approvals.length === 0) return 'pending'
    
    const hasRejected = approvals.some(a => a.status === 'rejected')
    if (hasRejected) return 'rejected'
    
    const allApproved = approvals.every(a => a.status === 'approved')
    if (allApproved) return 'approved'
    
    const hasApproved = approvals.some(a => a.status === 'approved')
    if (hasApproved) return 'in_progress'
    
    return 'pending'
  }

  const getStepIcon = (stepNumber: number) => {
    const status = getStepStatus(stepNumber)
    
    switch (status) {
      case 'approved':
        return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
      case 'rejected':
        return <XCircle className="text-red-600 dark:text-red-400" size={20} />
      case 'in_progress':
        return <Clock className="text-blue-600 dark:text-blue-400" size={20} />
      default:
        return <Clock className="text-gray-400 dark:text-slate-500" size={20} />
    }
  }

  const getStepColor = (stepNumber: number) => {
    const status = getStepStatus(stepNumber)
    
    switch (status) {
      case 'approved':
        return 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
      case 'rejected':
        return 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
      case 'in_progress':
        return 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
    }
  }

  const config = getStatusConfig()
  const StatusIcon = config.icon
  const totalSteps = getTotalSteps()

  // Simple status badge view
  if (!showDetails) {
    return (
      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-3 inline-flex items-center gap-3`}>
        <StatusIcon className={config.iconColor} size={20} />
        <div>
          <div className={`font-semibold text-sm ${config.textColor}`}>
            {config.label}
          </div>
          <div className={`text-xs ${config.textColor} opacity-75`}>
            Step {workflowInstance.current_step + 1} of {totalSteps}
          </div>
        </div>
      </div>
    )
  }

  // Detailed status view with progress visualization
  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          <StatusIcon className={config.iconColor} size={24} />
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${config.textColor}`}>
              {config.label}
            </h3>
            <p className={`text-sm ${config.textColor} opacity-75 mt-1`}>
              {config.description}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div>
                <span className={`${config.textColor} opacity-75`}>Current Step:</span>{' '}
                <span className={`font-semibold ${config.textColor}`}>
                  {workflowInstance.current_step + 1} of {totalSteps}
                </span>
              </div>
              <div>
                <span className={`${config.textColor} opacity-75`}>Started:</span>{' '}
                <span className={`font-semibold ${config.textColor}`}>
                  {new Date(workflowInstance.started_at).toLocaleDateString()}
                </span>
              </div>
              {workflowInstance.completed_at && (
                <div>
                  <span className={`${config.textColor} opacity-75`}>Completed:</span>{' '}
                  <span className={`font-semibold ${config.textColor}`}>
                    {new Date(workflowInstance.completed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Visualization */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Approval Progress</h4>
        
        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-[20px] top-[30px] bottom-[30px] w-0.5 bg-gray-200 dark:bg-slate-600"></div>
          
          {/* Steps */}
          <div className="space-y-4">
            {Array.from({ length: totalSteps }, (_, i) => i).map((stepNumber) => {
              const approvals = workflowInstance.approvals[stepNumber] || []
              const isCurrent = stepNumber === workflowInstance.current_step
              const stepStatus = getStepStatus(stepNumber)
              
              return (
                <div key={stepNumber} className="relative pl-12">
                  {/* Step icon */}
                  <div className={`absolute left-0 top-1 bg-white dark:bg-slate-800 p-1 rounded-full border-2 ${
                    isCurrent ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/50' : 'border-gray-200 dark:border-slate-600'
                  }`}>
                    {getStepIcon(stepNumber)}
                  </div>
                  
                  {/* Step card */}
                  <div className={`border rounded-lg p-3 ${getStepColor(stepNumber)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-gray-900 dark:text-slate-100">
                        Step {stepNumber + 1}
                        {isCurrent && (
                          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </h5>
                      <span className="text-xs text-gray-600 dark:text-slate-400">
                        {approvals.length} approver{approvals.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {/* Approvers */}
                    {approvals.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {approvals.map((approval) => (
                          <div
                            key={approval.id}
                            className="flex items-center justify-between text-xs bg-white dark:bg-slate-800/50 rounded px-2 py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <User size={14} className="text-gray-400 dark:text-slate-500" />
                              <span className="text-gray-700 dark:text-slate-300">
                                {approval.approver_id.slice(0, 8)}...
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {approval.status === 'approved' && (
                                <>
                                  <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
                                  <span className="text-green-700 font-medium">Approved</span>
                                </>
                              )}
                              {approval.status === 'rejected' && (
                                <>
                                  <XCircle size={14} className="text-red-600 dark:text-red-400" />
                                  <span className="text-red-700 font-medium">Rejected</span>
                                </>
                              )}
                              {approval.status === 'pending' && (
                                <>
                                  <Clock size={14} className="text-yellow-600 dark:text-yellow-400" />
                                  <span className="text-yellow-700 font-medium">Pending</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'

interface WorkflowStatusBadgeProps {
  status: string
  currentStep: number
  workflowName: string
  pendingApprovals: number
  onClick?: () => void
}

export default function WorkflowStatusBadge({
  status,
  currentStep,
  workflowName,
  pendingApprovals,
  onClick
}: WorkflowStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-300',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          label: 'Pending Approval'
        }
      case 'in_progress':
        return {
          icon: Clock,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-300',
          iconColor: 'text-blue-600 dark:text-blue-400',
          label: 'In Progress'
        }
      case 'completed':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-300',
          iconColor: 'text-green-600 dark:text-green-400',
          label: 'Approved'
        }
      case 'rejected':
        return {
          icon: XCircle,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-300',
          iconColor: 'text-red-600 dark:text-red-400',
          label: 'Rejected'
        }
      default:
        return {
          icon: AlertCircle,
          bgColor: 'bg-gray-50 dark:bg-slate-800/50',
          borderColor: 'border-gray-200 dark:border-slate-700',
          textColor: 'text-gray-800 dark:text-slate-200',
          iconColor: 'text-gray-600 dark:text-slate-400',
          label: 'Unknown'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon
  const hasPendingApprovals = pendingApprovals > 0 && (status === 'pending' || status === 'in_progress')

  return (
    <button
      onClick={onClick}
      className={`
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        border-2 rounded-lg p-4 min-w-[240px]
        transition-all duration-200
        ${onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}
        ${hasPendingApprovals ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <Icon className={`${config.iconColor} flex-shrink-0 mt-0.5`} size={20} />
        
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm mb-1">
            {config.label}
          </div>
          
          <div className="text-xs opacity-90 mb-2">
            {workflowName}
          </div>
          
          <div className="text-xs opacity-75">
            Step {currentStep + 1}
          </div>
          
          {hasPendingApprovals && (
            <div className="mt-2 pt-2 border-t border-current/20">
              <div className="flex items-center gap-1 font-medium text-xs">
                <AlertCircle size={14} />
                <span>{pendingApprovals} pending approval{pendingApprovals !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

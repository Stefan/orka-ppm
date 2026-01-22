'use client'

import { CheckCircle, XCircle, Clock, ArrowRight, User, MessageSquare } from 'lucide-react'

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

interface WorkflowHistoryProps {
  workflowInstance: WorkflowInstance
}

interface HistoryEvent {
  timestamp: string
  type: 'created' | 'approval' | 'step_change' | 'completed' | 'rejected'
  step?: number
  user?: string
  status?: string
  comments?: string
}

export default function WorkflowHistory({ workflowInstance }: WorkflowHistoryProps) {
  const generateHistoryEvents = (): HistoryEvent[] => {
    const events: HistoryEvent[] = []

    // Add creation event
    events.push({
      timestamp: workflowInstance.started_at,
      type: 'created',
      user: workflowInstance.started_by
    })

    // Add approval events from all steps
    Object.entries(workflowInstance.approvals).forEach(([stepNum, approvals]) => {
      const step = parseInt(stepNum)
      
      approvals.forEach((approval) => {
        if (approval.approved_at) {
          events.push({
            timestamp: approval.approved_at,
            type: 'approval',
            step,
            user: approval.approver_id,
            status: approval.status,
            comments: approval.comments || undefined
          })
        }
      })
    })

    // Add completion/rejection event
    if (workflowInstance.status === 'completed' && workflowInstance.completed_at) {
      events.push({
        timestamp: workflowInstance.completed_at,
        type: 'completed'
      })
    } else if (workflowInstance.status === 'rejected') {
      events.push({
        timestamp: workflowInstance.updated_at,
        type: 'rejected'
      })
    }

    // Sort by timestamp
    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  const getEventIcon = (event: HistoryEvent) => {
    switch (event.type) {
      case 'created':
        return <Clock className="text-blue-600" size={20} />
      case 'approval':
        return event.status === 'approved' ? (
          <CheckCircle className="text-green-600" size={20} />
        ) : (
          <XCircle className="text-red-600" size={20} />
        )
      case 'step_change':
        return <ArrowRight className="text-blue-600" size={20} />
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />
      case 'rejected':
        return <XCircle className="text-red-600" size={20} />
      default:
        return <Clock className="text-gray-600" size={20} />
    }
  }

  const getEventTitle = (event: HistoryEvent) => {
    switch (event.type) {
      case 'created':
        return 'Workflow Created'
      case 'approval':
        return event.status === 'approved' ? 'Approved' : 'Rejected'
      case 'step_change':
        return `Advanced to Step ${(event.step || 0) + 1}`
      case 'completed':
        return 'Workflow Completed'
      case 'rejected':
        return 'Workflow Rejected'
      default:
        return 'Event'
    }
  }

  const getEventDescription = (event: HistoryEvent) => {
    switch (event.type) {
      case 'created':
        return `Workflow initiated by ${event.user?.slice(0, 8)}`
      case 'approval':
        return `Step ${(event.step || 0) + 1} ${event.status} by ${event.user?.slice(0, 8)}`
      case 'step_change':
        return `Workflow advanced to next step`
      case 'completed':
        return 'All approvals completed successfully'
      case 'rejected':
        return 'Workflow was rejected'
      default:
        return ''
    }
  }

  const getEventColor = (event: HistoryEvent) => {
    switch (event.type) {
      case 'created':
        return 'border-blue-200 bg-blue-50'
      case 'approval':
        return event.status === 'approved' 
          ? 'border-green-200 bg-green-50' 
          : 'border-red-200 bg-red-50'
      case 'step_change':
        return 'border-blue-200 bg-blue-50'
      case 'completed':
        return 'border-green-200 bg-green-50'
      case 'rejected':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const historyEvents = generateHistoryEvents()

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-4">Workflow History</h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[20px] top-[30px] bottom-[30px] w-0.5 bg-gray-200"></div>
        
        {/* Events */}
        <div className="space-y-4">
          {historyEvents.map((event, index) => (
            <div key={index} className="relative pl-12">
              {/* Icon */}
              <div className="absolute left-0 top-1 bg-white p-1 rounded-full border-2 border-gray-200">
                {getEventIcon(event)}
              </div>
              
              {/* Event card */}
              <div className={`border rounded-lg p-4 ${getEventColor(event)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {getEventTitle(event)}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {getEventDescription(event)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
                
                {/* Comments */}
                {event.comments && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="text-gray-400 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-sm text-gray-700">{event.comments}</p>
                    </div>
                  </div>
                )}
                
                {/* User info */}
                {event.user && event.type !== 'created' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <User size={14} />
                    <span>User: {event.user.slice(0, 8)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {historyEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No history events available
        </div>
      )}
    </div>
  )
}

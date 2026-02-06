'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, MessageSquare, User, Calendar, Send, UserCheck, ChevronDown, ChevronRight, DollarSign, TrendingUp } from 'lucide-react'
import { ChangeRequest, ImpactAnalysisData, mockDataService } from '../lib/mockData'
import { useAsyncData, LoadingState } from '../lib/loadingStates'
import { workflowManager, WorkflowContext, WorkflowStep, WorkflowAction } from '../lib/workflowManager'
import { useTranslations } from '@/lib/i18n/context'

interface ApprovalWorkflowProps {
  changeId: string
  userRole: string
  currentUserId: string
  onDecisionMade?: (approvalId: string, decision: string) => void
  onDelegate?: (approvalId: string, delegateTo: string) => void
}

const DECISION_OPTIONS = [
  { value: 'approved', label: 'Approve', icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  { value: 'rejected', label: 'Reject', icon: XCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  { value: 'needs_info', label: 'Request Info', icon: MessageSquare, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { value: 'delegated', label: 'Delegate', icon: UserCheck, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' }
]

export default function ApprovalWorkflow({ 
  changeId, 
  userRole, 
  currentUserId,
  onDecisionMade,
  onDelegate 
}: ApprovalWorkflowProps) {
  const t = useTranslations('changes');
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<string>('')
  const [decisionComments, setDecisionComments] = useState('')
  const [conditions, setConditions] = useState('')
  const [delegateToUser, setDelegateToUser] = useState('')
  const [showImpactDetails, setShowImpactDetails] = useState(false)
  // Use enhanced async data loading
  const {
    data: changeRequest,
    isLoading: isLoadingChange,
    isError: isErrorChange,
    error: errorChange,
    refetch: refetchChange
  } = useAsyncData<ChangeRequest>(
    () => Promise.resolve(mockDataService.getChangeRequest(changeId)),
    [changeId]
  )

  const {
    data: impactAnalysis,
    isLoading: isLoadingImpact,
    isError: isErrorImpact,
    error: errorImpact
  } = useAsyncData<ImpactAnalysisData>(
    () => Promise.resolve(mockDataService.getImpactAnalysis(changeId)),
    [changeId]
  )

  // Create workflow context
  const workflowContext: WorkflowContext | null = changeRequest && impactAnalysis ? {
    user: {
      id: currentUserId,
      role: userRole,
      permissions: ['change_approve', 'technical_review'] // Mock permissions
    },
    changeRequest,
    impactAnalysis,
    metadata: {}
  } : null

  // Get available workflow actions
  const availableActions = workflowContext ? 
    workflowManager.getAvailableActions(changeRequest!.status as WorkflowStep, workflowContext) : []

  // Get workflow progress
  const workflowProgress = changeRequest ? 
    workflowManager.getWorkflowProgress(changeRequest) : null

  const handleMakeDecision = (action: WorkflowAction) => {
    setSelectedDecision(action)
    setDecisionComments('')
    setConditions('')
    setDelegateToUser('')
    setShowDecisionModal(true)
  }

  const handleSubmitDecision = async () => {
    if (!selectedDecision || !changeRequest || !workflowContext) return

    try {
      const currentStatus = changeRequest.status as WorkflowStep
      const targetStatus = availableActions.find(a => a.action === selectedDecision)?.to

      if (!targetStatus) return

      const result = await workflowManager.executeTransition(
        currentStatus,
        targetStatus,
        selectedDecision as WorkflowAction,
        workflowContext
      )

      if (result.success) {
        console.log('Decision submitted successfully:', result)
        
        if (onDecisionMade) {
          onDecisionMade(changeId, selectedDecision)
        }

        if (selectedDecision === 'delegate' && onDelegate) {
          onDelegate(changeId, delegateToUser)
        }

        setShowDecisionModal(false)
        refetchChange() // Refresh the change request data
      } else {
        console.error('Decision submission failed:', result.errors)
      }
    } catch (error) {
      console.error('Error submitting decision:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isLoading = isLoadingChange || isLoadingImpact
  const isError = isErrorChange || isErrorImpact
  const error = errorChange || errorImpact

  return (
    <LoadingState
      state={isLoading ? 'loading' : isError ? 'error' : changeRequest ? 'success' : 'error'}
      message={t('approvalWorkflow.loading')}
      error={error || (!changeRequest ? t('approvalWorkflow.notFound') : '')}
      fallback={
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.notFound')}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {t('approvalWorkflow.notFoundMessage')}
          </p>
        </div>
      }
    >
      {changeRequest && workflowProgress && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Change Request Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                  {changeRequest.change_number}: {changeRequest.title}
                </h2>
                <p className="text-gray-600 dark:text-slate-400 mt-1">{changeRequest.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  changeRequest.priority === 'high' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                  changeRequest.priority === 'critical' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                  changeRequest.priority === 'emergency' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                }`}>
                  {changeRequest.priority}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 capitalize">
                  {changeRequest.change_type}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                <User className="h-4 w-4" />
                <span>{t('approvalWorkflow.requestedBy')}: <span className="font-medium">{changeRequest.requested_by}</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>{t('approvalWorkflow.requested')}: <span className="font-medium">{formatDate(changeRequest.requested_date)}</span></span>
              </div>
              {changeRequest.required_by_date && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>{t('approvalWorkflow.requiredBy')}: <span className="font-medium">{formatDate(changeRequest.required_by_date)}</span></span>
                </div>
              )}
            </div>

            {/* Impact Summary */}
            {impactAnalysis && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowImpactDetails(!showImpactDetails)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-blue-600"
                >
                  {showImpactDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {t('approvalWorkflow.impactSummary')}
                </button>
                
                {showImpactDetails && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.costImpact')}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        ${impactAnalysis.total_cost_impact.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.scheduleImpact')}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {impactAnalysis.schedule_impact_days} days
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.criticalPath')}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {impactAnalysis.critical_path_affected ? t('approvalWorkflow.affected') : t('approvalWorkflow.notAffected')}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.newRisks')}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {impactAnalysis.new_risks.length}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Workflow Progress */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('approvalWorkflow.workflowProgress')}</h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t('approvalWorkflow.progress')}: {workflowProgress.progressPercentage}%
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${workflowProgress.progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Current Status and Available Actions */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">{t('approvalWorkflow.currentStatus')}</h4>
                  <p className="text-blue-700 capitalize">{workflowProgress.currentStep.replace('_', ' ')}</p>
                </div>
                <div className="flex gap-2">
                  {availableActions.filter(action => action.enabled).map(action => (
                    <button
                      key={action.action}
                      onClick={() => handleMakeDecision(action.action)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {action.description}
                    </button>
                  ))}
                </div>
              </div>
              
              {availableActions.some(action => !action.enabled) && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">{t('approvalWorkflow.unavailableActions')}:</h5>
                  {availableActions.filter(action => !action.enabled).map(action => (
                    <div key={action.action} className="text-sm text-blue-700">
                      <span className="font-medium">{action.description}:</span> {action.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Workflow Steps Visualization */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100">{t('approvalWorkflow.workflowSteps')}</h4>
              
              {/* Completed Steps */}
              {workflowProgress.completedSteps.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-green-700 mb-2">{t('approvalWorkflow.completedSteps')}</h5>
                  <div className="space-y-2">
                    {workflowProgress.completedSteps.map((step) => (
                      <div key={step} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                        <span className="font-medium text-green-900 capitalize">{step.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Step */}
              <div>
                <h5 className="text-sm font-medium text-blue-700 mb-2">{t('approvalWorkflow.currentStep')}</h5>
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-pulse" />
                  <span className="font-medium text-blue-900 capitalize">{workflowProgress.currentStep.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Next Steps */}
              {workflowProgress.nextSteps.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('approvalWorkflow.upcomingSteps')}</h5>
                  <div className="space-y-2">
                    {workflowProgress.nextSteps.slice(0, 3).map((step) => (
                      <div key={step} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg">
                        <Clock className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                        <span className="font-medium text-gray-700 dark:text-slate-300 capitalize">{step.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {t('approvalWorkflow.makeDecision')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                {t('approvalWorkflow.action')}: {t(`approvalWorkflow.decisions.${selectedDecision}` as any) || selectedDecision}
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t('approvalWorkflow.comments')} {selectedDecision === 'reject' || selectedDecision === 'request_info' ? t('approvalWorkflow.commentsRequired') : t('approvalWorkflow.commentsOptional')}
                </label>
                <textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={
                    selectedDecision === 'approve' ? t('approvalWorkflow.commentsPlaceholder.approve') :
                    selectedDecision === 'reject' ? t('approvalWorkflow.commentsPlaceholder.reject') :
                    selectedDecision === 'request_info' ? t('approvalWorkflow.commentsPlaceholder.requestInfo') :
                    selectedDecision === 'delegate' ? t('approvalWorkflow.commentsPlaceholder.delegate') :
                    t('approvalWorkflow.commentsPlaceholder.default')
                  }
                />
              </div>
              
              {/* Conditional Approval Conditions */}
              {selectedDecision === 'approve' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t('approvalWorkflow.approvalConditions')}
                  </label>
                  <textarea
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('approvalWorkflow.approvalConditionsPlaceholder')}
                  />
                </div>
              )}
              
              {/* Delegation User */}
              {selectedDecision === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t('approvalWorkflow.delegateTo')}
                  </label>
                  <input
                    type="text"
                    value={delegateToUser}
                    onChange={(e) => setDelegateToUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('approvalWorkflow.delegateToPlaceholder')}
                  />
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDecisionModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
              >
                {t('approvalWorkflow.cancel')}
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={
                  !selectedDecision || 
                  (selectedDecision === 'delegate' && !delegateToUser) ||
                  ((selectedDecision === 'reject' || selectedDecision === 'request_info') && !decisionComments.trim())
                }
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {t('approvalWorkflow.submitDecision')}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </LoadingState>
  )
}
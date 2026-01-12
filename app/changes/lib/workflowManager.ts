/**
 * Enhanced Workflow Manager for Change Management System
 * Handles complex workflows and edge cases with robust error handling
 */

import { ChangeRequest, ImpactAnalysisData } from './mockData'

export type WorkflowStep = 
  | 'draft'
  | 'validation'
  | 'impact_analysis'
  | 'technical_review'
  | 'approval_routing'
  | 'approval_pending'
  | 'approved'
  | 'implementation_planning'
  | 'implementation'
  | 'verification'
  | 'closure'
  | 'rejected'
  | 'cancelled'

export type WorkflowAction = 
  | 'submit'
  | 'validate'
  | 'analyze_impact'
  | 'technical_approve'
  | 'technical_reject'
  | 'route_for_approval'
  | 'approve'
  | 'reject'
  | 'request_info'
  | 'delegate'
  | 'escalate'
  | 'start_implementation'
  | 'update_progress'
  | 'complete_implementation'
  | 'verify'
  | 'close'
  | 'cancel'
  | 'reopen'

export interface WorkflowRule {
  from: WorkflowStep
  to: WorkflowStep
  action: WorkflowAction
  conditions?: (changeRequest: ChangeRequest, context?: any) => boolean
  validations?: (changeRequest: ChangeRequest, context?: any) => string[]
  sideEffects?: (changeRequest: ChangeRequest, context?: any) => Promise<void>
}

export interface WorkflowContext {
  user: {
    id: string
    role: string
    permissions: string[]
  }
  changeRequest: ChangeRequest
  impactAnalysis?: ImpactAnalysisData
  metadata?: Record<string, any>
}

export interface WorkflowValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface WorkflowTransitionResult {
  success: boolean
  newStatus: WorkflowStep
  errors: string[]
  warnings: string[]
  sideEffects?: string[]
}

export class WorkflowManager {
  private rules: WorkflowRule[] = []

  constructor() {
    this.initializeRules()
  }

  private initializeRules() {
    // Draft to Validation
    this.addRule({
      from: 'draft',
      to: 'validation',
      action: 'submit',
      validations: (cr) => {
        const errors: string[] = []
        if (!cr.title?.trim()) errors.push('Title is required')
        if (!cr.description?.trim()) errors.push('Description is required')
        if (!cr.justification?.trim()) errors.push('Justification is required')
        if (!cr.change_type) errors.push('Change type is required')
        if (!cr.priority) errors.push('Priority is required')
        if (!cr.project_id) errors.push('Project selection is required')
        return errors
      }
    })

    // Validation to Impact Analysis
    this.addRule({
      from: 'validation',
      to: 'impact_analysis',
      action: 'validate',
      conditions: (cr) => {
        // Auto-validation for simple changes
        return cr.estimated_cost_impact !== undefined && cr.estimated_cost_impact < 10000
      },
      validations: (cr) => {
        const errors: string[] = []
        if (cr.estimated_cost_impact === undefined) {
          errors.push('Cost impact estimate is required')
        }
        if (cr.estimated_schedule_impact_days === undefined) {
          errors.push('Schedule impact estimate is required')
        }
        return errors
      }
    })

    // Impact Analysis to Technical Review
    this.addRule({
      from: 'impact_analysis',
      to: 'technical_review',
      action: 'analyze_impact',
      conditions: (_cr, context) => {
        return context?.impactAnalysis !== undefined
      },
      validations: (cr, context) => {
        const errors: string[] = []
        if (!context?.impactAnalysis) {
          errors.push('Impact analysis must be completed before technical review')
        }
        if (cr.change_type === 'design' && !cr.attachments?.some(a => a.file_type.includes('dwg'))) {
          errors.push('Design changes require technical drawings')
        }
        return errors
      }
    })

    // Technical Review outcomes
    this.addRule({
      from: 'technical_review',
      to: 'approval_routing',
      action: 'technical_approve',
      conditions: (_cr, context) => {
        return context?.user?.permissions?.includes('technical_review')
      }
    })

    this.addRule({
      from: 'technical_review',
      to: 'draft',
      action: 'technical_reject',
      conditions: (_cr, context) => {
        return context?.user?.permissions?.includes('technical_review')
      }
    })

    // Approval Routing to Pending
    this.addRule({
      from: 'approval_routing',
      to: 'approval_pending',
      action: 'route_for_approval',
      validations: (cr) => {
        const errors: string[] = []
        if (!cr.pending_approvals || cr.pending_approvals.length === 0) {
          errors.push('At least one approver must be assigned')
        }
        return errors
      },
      sideEffects: async (cr) => {
        // Send notifications to approvers
        console.log(`Sending approval notifications for ${cr.change_number}`)
      }
    })

    // Approval outcomes
    this.addRule({
      from: 'approval_pending',
      to: 'approved',
      action: 'approve',
      conditions: (cr, context) => {
        // Check if user is an assigned approver
        const userIsApprover = cr.pending_approvals.some(
          approval => approval.approver_name === context?.user?.id && approval.status === 'pending'
        )
        
        // Check if all required approvals are obtained
        const allApproved = cr.pending_approvals.every(
          approval => approval.status !== 'pending'
        )
        
        return userIsApprover || allApproved
      },
      validations: (cr, context) => {
        const errors: string[] = []
        const userApproval = cr.pending_approvals.find(
          approval => approval.approver_name === context?.user?.id
        )
        
        if (!userApproval) {
          errors.push('You are not authorized to approve this change request')
        }
        
        if (userApproval?.status !== 'pending') {
          errors.push('This approval has already been processed')
        }
        
        return errors
      }
    })

    this.addRule({
      from: 'approval_pending',
      to: 'rejected',
      action: 'reject',
      conditions: (cr, context) => {
        return cr.pending_approvals.some(
          approval => approval.approver_name === context?.user?.id && approval.status === 'pending'
        )
      }
    })

    // Implementation workflow
    this.addRule({
      from: 'approved',
      to: 'implementation_planning',
      action: 'start_implementation',
      conditions: (_cr, context) => {
        return context?.user?.permissions?.includes('implementation_manage')
      },
      validations: (cr) => {
        const errors: string[] = []
        if (!cr.implementation_start_date) {
          errors.push('Implementation start date must be set')
        }
        return errors
      }
    })

    this.addRule({
      from: 'implementation_planning',
      to: 'implementation',
      action: 'start_implementation',
      validations: (cr) => {
        const errors: string[] = []
        if (cr.implementation_progress === undefined) {
          errors.push('Implementation plan must be created')
        }
        return errors
      }
    })

    this.addRule({
      from: 'implementation',
      to: 'verification',
      action: 'complete_implementation',
      conditions: (cr) => {
        return cr.implementation_progress === 100
      },
      validations: (cr) => {
        const errors: string[] = []
        if (cr.implementation_progress !== 100) {
          errors.push('Implementation must be 100% complete before verification')
        }
        if (!cr.actual_cost_impact) {
          errors.push('Actual cost impact must be recorded')
        }
        if (!cr.actual_schedule_impact_days) {
          errors.push('Actual schedule impact must be recorded')
        }
        return errors
      }
    })

    this.addRule({
      from: 'verification',
      to: 'closure',
      action: 'verify',
      conditions: (_cr, context) => {
        return context?.user?.permissions?.includes('change_verify')
      }
    })

    // Emergency change fast-track
    this.addRule({
      from: 'draft',
      to: 'approved',
      action: 'approve',
      conditions: (cr, context) => {
        return cr.priority === 'emergency' && 
               context?.user?.permissions?.includes('emergency_approve')
      },
      validations: (cr) => {
        const errors: string[] = []
        if (cr.priority !== 'emergency') {
          errors.push('Fast-track approval only available for emergency changes')
        }
        if (!cr.justification?.includes('EMERGENCY')) {
          errors.push('Emergency justification must be clearly stated')
        }
        return errors
      },
      sideEffects: async (cr) => {
        // Log emergency approval
        console.log(`Emergency approval granted for ${cr.change_number}`)
      }
    })

    // Cancellation and reopening
    this.addRule({
      from: 'draft',
      to: 'cancelled',
      action: 'cancel',
      conditions: (cr, context) => {
        return cr.requested_by === context?.user?.id || 
               context?.user?.permissions?.includes('change_admin')
      }
    })

    this.addRule({
      from: 'cancelled',
      to: 'draft',
      action: 'reopen',
      conditions: (_cr, context) => {
        return context?.user?.permissions?.includes('change_admin')
      }
    })

    // Escalation paths
    this.addRule({
      from: 'approval_pending',
      to: 'approval_pending',
      action: 'escalate',
      conditions: (cr, _context) => {
        const overdueApprovals = cr.pending_approvals.filter(approval => {
          const dueDate = new Date(approval.due_date)
          return dueDate < new Date() && approval.status === 'pending'
        })
        return overdueApprovals.length > 0
      },
      sideEffects: async (cr) => {
        // Escalate to higher authority
        console.log(`Escalating overdue approvals for ${cr.change_number}`)
      }
    })
  }

  private addRule(rule: WorkflowRule) {
    this.rules.push(rule)
  }

  public validateTransition(
    from: WorkflowStep,
    to: WorkflowStep,
    action: WorkflowAction,
    context: WorkflowContext
  ): WorkflowValidationResult {
    const applicableRules = this.rules.filter(
      rule => rule.from === from && rule.to === to && rule.action === action
    )

    if (applicableRules.length === 0) {
      return {
        isValid: false,
        errors: [`Invalid transition from ${from} to ${to} with action ${action}`],
        warnings: []
      }
    }

    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of applicableRules) {
      // Check conditions
      if (rule.conditions && !rule.conditions(context.changeRequest, context)) {
        errors.push(`Conditions not met for transition from ${from} to ${to}`)
        continue
      }

      // Run validations
      if (rule.validations) {
        const validationErrors = rule.validations(context.changeRequest, context)
        errors.push(...validationErrors)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  public async executeTransition(
    from: WorkflowStep,
    to: WorkflowStep,
    action: WorkflowAction,
    context: WorkflowContext
  ): Promise<WorkflowTransitionResult> {
    // Validate transition first
    const validation = this.validateTransition(from, to, action, context)
    
    if (!validation.isValid) {
      return {
        success: false,
        newStatus: from, // Stay in current state
        errors: validation.errors,
        warnings: validation.warnings
      }
    }

    try {
      // Execute side effects
      const applicableRules = this.rules.filter(
        rule => rule.from === from && rule.to === to && rule.action === action
      )

      const sideEffects: string[] = []
      
      for (const rule of applicableRules) {
        if (rule.sideEffects) {
          await rule.sideEffects(context.changeRequest, context)
          sideEffects.push(`Executed side effects for ${action}`)
        }
      }

      return {
        success: true,
        newStatus: to,
        errors: [],
        warnings: validation.warnings,
        sideEffects
      }
    } catch (error) {
      return {
        success: false,
        newStatus: from,
        errors: [`Failed to execute transition: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: validation.warnings
      }
    }
  }

  public getAvailableActions(
    currentStatus: WorkflowStep,
    context: WorkflowContext
  ): Array<{ action: WorkflowAction; to: WorkflowStep; description: string; enabled: boolean; reason?: string }> {
    const availableRules = this.rules.filter(rule => rule.from === currentStatus)
    
    return availableRules.map(rule => {
      const validation = this.validateTransition(currentStatus, rule.to, rule.action, context)
      const firstError = validation.errors.length > 0 ? validation.errors[0] : undefined
      
      return {
        action: rule.action,
        to: rule.to,
        description: this.getActionDescription(rule.action),
        enabled: validation.isValid,
        ...(firstError && { reason: firstError })
      }
    })
  }

  private getActionDescription(action: WorkflowAction): string {
    const descriptions: Record<WorkflowAction, string> = {
      submit: 'Submit for Review',
      validate: 'Validate Change Request',
      analyze_impact: 'Analyze Impact',
      technical_approve: 'Approve Technical Review',
      technical_reject: 'Reject Technical Review',
      route_for_approval: 'Route for Approval',
      approve: 'Approve Change',
      reject: 'Reject Change',
      request_info: 'Request Additional Information',
      delegate: 'Delegate Approval',
      escalate: 'Escalate for Review',
      start_implementation: 'Start Implementation',
      update_progress: 'Update Progress',
      complete_implementation: 'Complete Implementation',
      verify: 'Verify Implementation',
      close: 'Close Change Request',
      cancel: 'Cancel Change Request',
      reopen: 'Reopen Change Request'
    }
    
    return descriptions[action] || action
  }

  public getWorkflowProgress(changeRequest: ChangeRequest): {
    currentStep: WorkflowStep
    completedSteps: WorkflowStep[]
    nextSteps: WorkflowStep[]
    progressPercentage: number
  } {
    const allSteps: WorkflowStep[] = [
      'draft',
      'validation',
      'impact_analysis',
      'technical_review',
      'approval_routing',
      'approval_pending',
      'approved',
      'implementation_planning',
      'implementation',
      'verification',
      'closure'
    ]

    const currentStep = changeRequest.status as WorkflowStep
    const currentIndex = allSteps.indexOf(currentStep)
    
    const completedSteps = currentIndex >= 0 ? allSteps.slice(0, currentIndex) : []
    const nextSteps = currentIndex >= 0 ? allSteps.slice(currentIndex + 1) : allSteps
    
    const progressPercentage = currentIndex >= 0 ? 
      Math.round((currentIndex / (allSteps.length - 1)) * 100) : 0

    return {
      currentStep,
      completedSteps,
      nextSteps,
      progressPercentage
    }
  }

  // Edge case handlers
  public handleConcurrentApprovals(
    changeRequest: ChangeRequest,
    approvalDecisions: Array<{ approverId: string; decision: 'approve' | 'reject'; timestamp: Date }>
  ): { conflicts: string[]; resolution: 'approve' | 'reject' | 'pending' } {
    const conflicts: string[] = []
    
    // Check for timing conflicts
    const sortedDecisions = approvalDecisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    // Check for conflicting decisions within a short time window (5 minutes)
    for (let i = 1; i < sortedDecisions.length; i++) {
      const current = sortedDecisions[i]
      const previous = sortedDecisions[i-1]
      if (current && previous) {
        const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime()
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          conflicts.push(`Concurrent decisions by ${previous.approverId} and ${current.approverId}`)
        }
      }
    }

    // Determine resolution based on business rules
    const hasRejection = approvalDecisions.some(d => d.decision === 'reject')
    const allApproved = approvalDecisions.every(d => d.decision === 'approve')
    
    let resolution: 'approve' | 'reject' | 'pending'
    
    if (hasRejection) {
      resolution = 'reject' // Any rejection overrides approvals
    } else if (allApproved && approvalDecisions.length === changeRequest.pending_approvals.length) {
      resolution = 'approve'
    } else {
      resolution = 'pending'
    }

    return { conflicts, resolution }
  }

  public handleDataInconsistency(
    changeRequest: ChangeRequest,
    impactAnalysis?: ImpactAnalysisData
  ): { issues: string[]; canProceed: boolean; recommendations: string[] } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check for data consistency issues
    if (impactAnalysis) {
      // Cost consistency
      if (Math.abs((changeRequest.estimated_cost_impact || 0) - impactAnalysis.total_cost_impact) > 5000) {
        issues.push('Significant discrepancy between estimated and analyzed cost impact')
        recommendations.push('Review and reconcile cost estimates with detailed analysis')
      }

      // Schedule consistency
      if (Math.abs((changeRequest.estimated_schedule_impact_days || 0) - impactAnalysis.schedule_impact_days) > 5) {
        issues.push('Schedule impact estimates do not match detailed analysis')
        recommendations.push('Update schedule estimates based on detailed impact analysis')
      }

      // Critical path validation
      if (impactAnalysis.critical_path_affected && changeRequest.priority === 'low') {
        issues.push('Critical path impact detected but change priority is low')
        recommendations.push('Consider increasing priority due to critical path impact')
      }
    }

    // Approval consistency
    const overdueApprovals = changeRequest.pending_approvals.filter(approval => {
      const dueDate = new Date(approval.due_date)
      return dueDate < new Date() && approval.status === 'pending'
    })

    if (overdueApprovals.length > 0) {
      issues.push(`${overdueApprovals.length} approval(s) are overdue`)
      recommendations.push('Escalate overdue approvals or reassign to available approvers')
    }

    return {
      issues,
      canProceed: issues.length === 0,
      recommendations
    }
  }

  public handleEmergencyEscalation(
    changeRequest: ChangeRequest,
    _context: WorkflowContext
  ): { escalationPath: string[]; requiredApprovals: string[]; timeframe: string } {
    const escalationPath: string[] = []
    const requiredApprovals: string[] = []
    let timeframe = '24 hours'

    if (changeRequest.priority === 'emergency') {
      escalationPath.push('Project Manager')
      escalationPath.push('Engineering Director')
      escalationPath.push('Operations Manager')
      
      requiredApprovals.push('Emergency Approval Authority')
      timeframe = '4 hours'
      
      if (changeRequest.estimated_cost_impact && changeRequest.estimated_cost_impact > 50000) {
        escalationPath.push('Executive Director')
        requiredApprovals.push('Executive Approval')
        timeframe = '2 hours'
      }
    } else if (changeRequest.priority === 'critical') {
      escalationPath.push('Project Manager')
      escalationPath.push('Department Head')
      timeframe = '12 hours'
    }

    return {
      escalationPath,
      requiredApprovals,
      timeframe
    }
  }
}

// Singleton instance
export const workflowManager = new WorkflowManager()

// Utility functions for common workflow operations
export const canUserPerformAction = (
  action: WorkflowAction,
  userPermissions: string[],
  _changeRequest: ChangeRequest
): boolean => {
  const permissionMap: Record<WorkflowAction, string[]> = {
    submit: ['change_create'],
    validate: ['change_validate'],
    analyze_impact: ['impact_analyze'],
    technical_approve: ['technical_review'],
    technical_reject: ['technical_review'],
    route_for_approval: ['approval_route'],
    approve: ['change_approve'],
    reject: ['change_approve'],
    request_info: ['change_approve'],
    delegate: ['approval_delegate'],
    escalate: ['approval_escalate'],
    start_implementation: ['implementation_manage'],
    update_progress: ['implementation_update'],
    complete_implementation: ['implementation_manage'],
    verify: ['change_verify'],
    close: ['change_close'],
    cancel: ['change_cancel'],
    reopen: ['change_admin']
  }

  const requiredPermissions = permissionMap[action] || []
  return requiredPermissions.some(permission => userPermissions.includes(permission))
}

export const getWorkflowStepColor = (step: WorkflowStep): string => {
  const colorMap: Record<WorkflowStep, string> = {
    draft: 'gray',
    validation: 'yellow',
    impact_analysis: 'blue',
    technical_review: 'purple',
    approval_routing: 'orange',
    approval_pending: 'orange',
    approved: 'green',
    implementation_planning: 'blue',
    implementation: 'blue',
    verification: 'purple',
    closure: 'green',
    rejected: 'red',
    cancelled: 'gray'
  }
  
  return colorMap[step] || 'gray'
}
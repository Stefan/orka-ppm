'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Save, Settings, Users, DollarSign, Clock, CheckCircle, ArrowDown, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

// Types based on the design document
interface ApprovalRule {
  id: string
  name: string
  description: string
  is_active: boolean
  priority: number
  
  // Conditions
  conditions: {
    change_types: string[]
    priority_levels: string[]
    cost_threshold_min?: number
    cost_threshold_max?: number
    schedule_impact_days_min?: number
    schedule_impact_days_max?: number
    project_phases: string[]
    requires_emergency_approval: boolean
  }
  
  // Approval steps
  approval_steps: ApprovalStepConfig[]
  
  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  last_used?: string
  usage_count: number
}

interface ApprovalStepConfig {
  id: string
  step_number: number
  name: string
  description?: string
  
  // Approver configuration
  approver_type: 'role' | 'user' | 'group' | 'dynamic'
  approver_roles: string[]
  approver_users: string[]
  approver_groups: string[]
  dynamic_rule?: string // For dynamic approver selection
  
  // Step behavior
  is_required: boolean
  is_parallel: boolean
  depends_on_steps: number[]
  can_be_delegated: boolean
  can_be_escalated: boolean
  
  // Timing
  due_days: number
  escalation_days?: number
  escalate_to_roles?: string[]
  escalate_to_users?: string[]
  
  // Authority limits
  max_cost_authority?: number
  max_schedule_authority_days?: number
  
  // Conditions for this step
  step_conditions?: {
    required_when: string[]
    skip_when: string[]
  }
}

interface ApprovalAuthorityMatrix {
  id: string
  role: string
  user_id?: string
  user_name?: string
  
  // Authority limits
  max_cost_authority: number
  max_schedule_authority_days: number
  change_types_authorized: string[]
  project_phases_authorized: string[]
  
  // Delegation settings
  can_delegate: boolean
  can_receive_delegations: boolean
  backup_approvers: string[]
  
  // Status
  is_active: boolean
  effective_from: string
  effective_until?: string
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  is_system_template: boolean
  is_active: boolean
  
  // Template configuration
  default_steps: ApprovalStepConfig[]
  recommended_for: {
    change_types: string[]
    priority_levels: string[]
    cost_ranges: { min: number; max: number }[]
  }
  
  // Usage stats
  usage_count: number
  last_used?: string
  created_by: string
  created_at: string
}

export default function ApprovalWorkflowConfiguration() {
  const t = useTranslations('changes');
  const [activeTab, setActiveTab] = useState<'rules' | 'authority' | 'templates'>('rules')
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([])
  const [authorityMatrix, setAuthorityMatrix] = useState<ApprovalAuthorityMatrix[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [_showAuthorityModal, setShowAuthorityModal] = useState(false)
  const [_showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Form states
  const [ruleForm, setRuleForm] = useState<Partial<ApprovalRule>>({})
  const [_authorityForm, setAuthorityForm] = useState<Partial<ApprovalAuthorityMatrix>>({})
  const [_templateForm, _setTemplateForm] = useState<Partial<WorkflowTemplate>>({})
  
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set())
  const [expandedAuthorities, setExpandedAuthorities] = useState<Set<string>>(new Set())

  // Load approval rules, authority matrix, and templates from API when available
  useEffect(() => {
    setApprovalRules([])
    setAuthorityMatrix([])
    setWorkflowTemplates([])
    setLoading(false)
  }, [])

  const handleCreateRule = () => {
    setEditingItem(null)
    setRuleForm({
      name: '',
      description: '',
      is_active: true,
      priority: approvalRules.length + 1,
      conditions: {
        change_types: [],
        priority_levels: [],
        project_phases: [],
        requires_emergency_approval: false
      },
      approval_steps: []
    })
    setShowRuleModal(true)
  }

  const handleEditRule = (rule: ApprovalRule) => {
    setEditingItem(rule)
    setRuleForm(rule)
    setShowRuleModal(true)
  }

  const handleSaveRule = async () => {
    try {
      if (editingItem) {
        // Update existing rule
        setApprovalRules(prev => prev.map(rule => 
          rule.id === editingItem.id ? { ...rule, ...ruleForm } : rule
        ))
      } else {
        // Create new rule
        const newRule: ApprovalRule = {
          ...ruleForm as ApprovalRule,
          id: `rule-${Date.now()}`,
          created_by: 'current_user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0
        }
        setApprovalRules(prev => [...prev, newRule])
      }
      setShowRuleModal(false)
      setRuleForm({})
    } catch (error) {
      console.error('Error saving rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this approval rule?')) {
      setApprovalRules(prev => prev.filter(rule => rule.id !== ruleId))
    }
  }

  const handleCreateAuthority = () => {
    setEditingItem(null)
    setAuthorityForm({
      role: '',
      max_cost_authority: 0,
      max_schedule_authority_days: 0,
      change_types_authorized: [],
      project_phases_authorized: [],
      can_delegate: true,
      can_receive_delegations: true,
      backup_approvers: [],
      is_active: true,
      effective_from: new Date().toISOString()
    })
    setShowAuthorityModal(true)
  }

  const handleEditAuthority = (authority: ApprovalAuthorityMatrix) => {
    setEditingItem(authority)
    setAuthorityForm(authority)
    setShowAuthorityModal(true)
  }

  // const _handleSaveAuthority = async () => {
  //   try {
  //     if (editingItem) {
  //       // Update existing authority
  //       setAuthorityMatrix(prev => prev.map(auth => 
  //         auth.id === editingItem.id ? { ...auth, ...authorityForm } : auth
  //       ))
  //     } else {
  //       // Create new authority
  //       const newAuthority: ApprovalAuthorityMatrix = {
  //         ...authorityForm as ApprovalAuthorityMatrix,
  //         id: `auth-${Date.now()}`
  //       }
  //       setAuthorityMatrix(prev => [...prev, newAuthority])
  //     }
  //     setShowAuthorityModal(false)
  //     setAuthorityForm({})
  //   } catch (error) {
  //     console.error('Error saving authority:', error)
  //   }
  // }

  const handleDeleteAuthority = async (authorityId: string) => {
    if (confirm('Are you sure you want to delete this authority configuration?')) {
      setAuthorityMatrix(prev => prev.filter(auth => auth.id !== authorityId))
    }
  }

  const toggleRuleExpansion = (ruleId: string) => {
    const newExpanded = new Set(expandedRules)
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId)
    } else {
      newExpanded.add(ruleId)
    }
    setExpandedRules(newExpanded)
  }

  const toggleAuthorityExpansion = (authorityId: string) => {
    const newExpanded = new Set(expandedAuthorities)
    if (newExpanded.has(authorityId)) {
      newExpanded.delete(authorityId)
    } else {
      newExpanded.add(authorityId)
    }
    setExpandedAuthorities(newExpanded)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('approvalWorkflowConfiguration.title')}</h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">{t('approvalWorkflowConfiguration.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'rules', label: 'Approval Rules', icon: Settings },
              { id: 'authority', label: 'Authority Matrix', icon: Users },
              { id: 'templates', label: 'Workflow Templates', icon: Copy }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
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
          {/* Approval Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Approval Rules</h3>
                <button
                  onClick={handleCreateRule}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Rule
                </button>
              </div>

              <div className="space-y-4">
                {approvalRules.map((rule) => (
                  <div key={rule.id} className="border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">{rule.name}</h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              rule.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                            }`}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-slate-400">Priority: {rule.priority}</span>
                          </div>
                          
                          <p className="text-gray-600 dark:text-slate-400 mb-3">{rule.description}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-slate-300">Change Types:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.conditions.change_types.map(type => (
                                  <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700 dark:text-slate-300">Priority Levels:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.conditions.priority_levels.map(priority => (
                                  <span key={priority} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 capitalize">
                                    {priority}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700 dark:text-slate-300">Cost Threshold:</span>
                              <div className="mt-1 text-gray-600 dark:text-slate-400">
                                {rule.conditions.cost_threshold_min && `Min: ${formatCurrency(rule.conditions.cost_threshold_min)}`}
                                {rule.conditions.cost_threshold_min && rule.conditions.cost_threshold_max && ' - '}
                                {rule.conditions.cost_threshold_max && `Max: ${formatCurrency(rule.conditions.cost_threshold_max)}`}
                                {!rule.conditions.cost_threshold_min && !rule.conditions.cost_threshold_max && 'No limit'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                            <span>Steps: {rule.approval_steps.length}</span>
                            <span>Used: {rule.usage_count} times</span>
                            {rule.last_used && (
                              <span>Last used: {new Date(rule.last_used).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRuleExpansion(rule.id)}
                            className="text-gray-400 hover:text-gray-600 dark:text-slate-400"
                          >
                            {expandedRules.has(rule.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded Rule Details */}
                      {expandedRules.has(rule.id) && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                          <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-3">Approval Steps</h5>
                          <div className="space-y-3">
                            {rule.approval_steps.map((step, index) => (
                              <div key={step.id} className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-gray-900 dark:text-slate-100">
                                        Step {step.step_number}: {step.name}
                                      </span>
                                      {step.is_parallel && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                                          Parallel
                                        </span>
                                      )}
                                      {!step.is_required && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                                          Optional
                                        </span>
                                      )}
                                    </div>
                                    
                                    {step.description && (
                                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{step.description}</p>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-slate-400">
                                      <div>
                                        <span className="font-medium">Approvers:</span>
                                        <div className="mt-1">
                                          {step.approver_roles.map(role => (
                                            <span key={role} className="inline-block mr-1 px-1 py-0.5 bg-white dark:bg-slate-800 rounded border text-xs capitalize">
                                              {role.replace('_', ' ')}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Timing:</span>
                                        <div className="mt-1">
                                          Due: {step.due_days} days
                                          {step.escalation_days && `, Escalate: ${step.escalation_days} days`}
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Authority:</span>
                                        <div className="mt-1">
                                          {step.max_cost_authority && `Cost: ${formatCurrency(step.max_cost_authority)}`}
                                          {step.max_schedule_authority_days && `, Schedule: ${step.max_schedule_authority_days} days`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {index < rule.approval_steps.length - 1 && (
                                  <div className="flex justify-center mt-2">
                                    <ArrowDown className="h-3 w-3 text-gray-400 dark:text-slate-500" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Authority Matrix Tab */}
          {activeTab === 'authority' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Approval Authority Matrix</h3>
                <button
                  onClick={handleCreateAuthority}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Authority
                </button>
              </div>

              <div className="space-y-4">
                {authorityMatrix.map((authority) => (
                  <div key={authority.id} className="border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 capitalize">
                              {authority.role.replace('_', ' ')}
                            </h4>
                            {authority.user_name && (
                              <span className="text-gray-600 dark:text-slate-400">- {authority.user_name}</span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              authority.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                            }`}>
                              {authority.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Cost Authority</span>
                              </div>
                              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                                {formatCurrency(authority.max_cost_authority)}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Schedule Authority</span>
                              </div>
                              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                                {authority.max_schedule_authority_days} days
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Delegation</span>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-slate-100">
                                {authority.can_delegate ? 'Can delegate' : 'Cannot delegate'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-slate-400">
                                {authority.can_receive_delegations ? 'Can receive' : 'Cannot receive'}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Change Types</span>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-slate-100">
                                {authority.change_types_authorized.length} authorized
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                            <span>Effective from: {new Date(authority.effective_from).toLocaleDateString()}</span>
                            {authority.effective_until && (
                              <span>Until: {new Date(authority.effective_until).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAuthorityExpansion(authority.id)}
                            className="text-gray-400 hover:text-gray-600 dark:text-slate-400"
                          >
                            {expandedAuthorities.has(authority.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEditAuthority(authority)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAuthority(authority.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded Authority Details */}
                      {expandedAuthorities.has(authority.id) && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Authorized Change Types</h5>
                              <div className="flex flex-wrap gap-1">
                                {authority.change_types_authorized.map(type => (
                                  <span key={type} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Authorized Project Phases</h5>
                              <div className="flex flex-wrap gap-1">
                                {authority.project_phases_authorized.map(phase => (
                                  <span key={phase} className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 capitalize">
                                    {phase}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {authority.backup_approvers.length > 0 && (
                              <div className="md:col-span-2">
                                <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Backup Approvers</h5>
                                <div className="flex flex-wrap gap-1">
                                  {authority.backup_approvers.map(backup => (
                                    <span key={backup} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200">
                                      {backup}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Workflow Templates</h3>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflowTemplates.map((template) => (
                  <div key={template.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">{template.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{template.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {template.is_system_template && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            System
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          template.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                        }`}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Category:</span>
                        <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">{template.category}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Steps:</span>
                        <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">{template.default_steps.length}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Usage:</span>
                        <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">{template.usage_count} times</span>
                      </div>
                      
                      {template.last_used && (
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Last used:</span>
                          <span className="ml-2 text-sm text-gray-600 dark:text-slate-400">
                            {new Date(template.last_used).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">Recommended for:</span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {template.recommended_for.change_types.map(type => (
                            <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                              {type}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.recommended_for.priority_levels.map(priority => (
                            <span key={priority} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 capitalize">
                              {priority}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">
                        Use Template
                      </button>
                      
                      {!template.is_system_template && (
                        <>
                          <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {editingItem ? 'Edit Approval Rule' : 'Create Approval Rule'}
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Rule Name *</label>
                  <input
                    type="text"
                    value={ruleForm.name || ''}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter rule name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Priority</label>
                  <input
                    type="number"
                    value={ruleForm.priority || 1}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Description</label>
                <textarea
                  value={ruleForm.description || ''}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe when this rule should be applied"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={ruleForm.is_active || false}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Active Rule
                </label>
              </div>
              
              {/* Additional form fields would go here for conditions and approval steps */}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {editingItem ? 'Update' : 'Create'} Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
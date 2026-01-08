'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Save, Settings, Users, DollarSign, Clock, CheckCircle, ArrowDown, Copy, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'rules' | 'authority' | 'templates'>('rules')
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([])
  const [authorityMatrix, setAuthorityMatrix] = useState<ApprovalAuthorityMatrix[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [showAuthorityModal, setShowAuthorityModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Form states
  const [ruleForm, setRuleForm] = useState<Partial<ApprovalRule>>({})
  const [authorityForm, setAuthorityForm] = useState<Partial<ApprovalAuthorityMatrix>>({})
  const [templateForm, setTemplateForm] = useState<Partial<WorkflowTemplate>>({})
  
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set())
  const [expandedAuthorities, setExpandedAuthorities] = useState<Set<string>>(new Set())

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockApprovalRules: ApprovalRule[] = [
      {
        id: 'rule-1',
        name: 'Standard Design Changes',
        description: 'Standard approval workflow for design changes under $50K',
        is_active: true,
        priority: 1,
        conditions: {
          change_types: ['design'],
          priority_levels: ['low', 'medium', 'high'],
          cost_threshold_max: 50000,
          project_phases: ['design', 'construction'],
          requires_emergency_approval: false
        },
        approval_steps: [
          {
            id: 'step-1',
            step_number: 1,
            name: 'Technical Review',
            description: 'Technical feasibility and compliance review',
            approver_type: 'role',
            approver_roles: ['technical_reviewer'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: false,
            depends_on_steps: [],
            can_be_delegated: true,
            can_be_escalated: true,
            due_days: 3,
            escalation_days: 5,
            escalate_to_roles: ['senior_technical_reviewer'],
            max_cost_authority: 50000
          },
          {
            id: 'step-2',
            step_number: 2,
            name: 'Project Manager Approval',
            description: 'Project manager review and approval',
            approver_type: 'role',
            approver_roles: ['project_manager'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: false,
            depends_on_steps: [1],
            can_be_delegated: true,
            can_be_escalated: true,
            due_days: 2,
            escalation_days: 4,
            escalate_to_roles: ['senior_project_manager'],
            max_cost_authority: 50000
          }
        ],
        created_by: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        last_used: '2024-01-20T14:20:00Z',
        usage_count: 25
      },
      {
        id: 'rule-2',
        name: 'High-Value Changes',
        description: 'Enhanced approval workflow for changes over $50K',
        is_active: true,
        priority: 2,
        conditions: {
          change_types: ['design', 'budget', 'scope'],
          priority_levels: ['high', 'critical'],
          cost_threshold_min: 50000,
          project_phases: ['design', 'construction'],
          requires_emergency_approval: false
        },
        approval_steps: [
          {
            id: 'step-1',
            step_number: 1,
            name: 'Technical Review',
            approver_type: 'role',
            approver_roles: ['technical_reviewer'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: false,
            depends_on_steps: [],
            can_be_delegated: true,
            can_be_escalated: true,
            due_days: 2,
            escalation_days: 3,
            escalate_to_roles: ['senior_technical_reviewer'],
            max_cost_authority: 100000
          },
          {
            id: 'step-2',
            step_number: 2,
            name: 'Budget Manager Approval',
            approver_type: 'role',
            approver_roles: ['budget_manager'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: true,
            depends_on_steps: [1],
            can_be_delegated: false,
            can_be_escalated: true,
            due_days: 2,
            escalation_days: 3,
            escalate_to_roles: ['finance_director'],
            max_cost_authority: 200000
          },
          {
            id: 'step-3',
            step_number: 3,
            name: 'Project Manager Approval',
            approver_type: 'role',
            approver_roles: ['project_manager'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: true,
            depends_on_steps: [1],
            can_be_delegated: true,
            can_be_escalated: true,
            due_days: 2,
            escalation_days: 3,
            escalate_to_roles: ['senior_project_manager'],
            max_cost_authority: 100000
          }
        ],
        created_by: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-10T16:45:00Z',
        last_used: '2024-01-18T11:30:00Z',
        usage_count: 12
      }
    ]

    const mockAuthorityMatrix: ApprovalAuthorityMatrix[] = [
      {
        id: 'auth-1',
        role: 'project_manager',
        user_id: 'user-1',
        user_name: 'Sarah Johnson',
        max_cost_authority: 50000,
        max_schedule_authority_days: 14,
        change_types_authorized: ['design', 'schedule', 'resource'],
        project_phases_authorized: ['design', 'construction'],
        can_delegate: true,
        can_receive_delegations: true,
        backup_approvers: ['user-2', 'user-3'],
        is_active: true,
        effective_from: '2024-01-01T00:00:00Z'
      },
      {
        id: 'auth-2',
        role: 'budget_manager',
        user_id: 'user-2',
        user_name: 'Mike Davis',
        max_cost_authority: 200000,
        max_schedule_authority_days: 30,
        change_types_authorized: ['budget', 'scope', 'design'],
        project_phases_authorized: ['design', 'construction', 'closeout'],
        can_delegate: false,
        can_receive_delegations: true,
        backup_approvers: ['user-4'],
        is_active: true,
        effective_from: '2024-01-01T00:00:00Z'
      }
    ]

    const mockWorkflowTemplates: WorkflowTemplate[] = [
      {
        id: 'template-1',
        name: 'Simple Approval',
        description: 'Single-step approval for low-impact changes',
        category: 'Standard',
        is_system_template: true,
        is_active: true,
        default_steps: [
          {
            id: 'step-1',
            step_number: 1,
            name: 'Manager Approval',
            approver_type: 'role',
            approver_roles: ['project_manager'],
            approver_users: [],
            approver_groups: [],
            is_required: true,
            is_parallel: false,
            depends_on_steps: [],
            can_be_delegated: true,
            can_be_escalated: true,
            due_days: 3,
            escalation_days: 5,
            max_cost_authority: 25000
          }
        ],
        recommended_for: {
          change_types: ['resource', 'schedule'],
          priority_levels: ['low', 'medium'],
          cost_ranges: [{ min: 0, max: 25000 }]
        },
        usage_count: 45,
        last_used: '2024-01-19T09:15:00Z',
        created_by: 'system',
        created_at: '2024-01-01T00:00:00Z'
      }
    ]

    setTimeout(() => {
      setApprovalRules(mockApprovalRules)
      setAuthorityMatrix(mockAuthorityMatrix)
      setWorkflowTemplates(mockWorkflowTemplates)
      setLoading(false)
    }, 1000)
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

  const handleSaveAuthority = async () => {
    try {
      if (editingItem) {
        // Update existing authority
        setAuthorityMatrix(prev => prev.map(auth => 
          auth.id === editingItem.id ? { ...auth, ...authorityForm } : auth
        ))
      } else {
        // Create new authority
        const newAuthority: ApprovalAuthorityMatrix = {
          ...authorityForm as ApprovalAuthorityMatrix,
          id: `auth-${Date.now()}`
        }
        setAuthorityMatrix(prev => [...prev, newAuthority])
      }
      setShowAuthorityModal(false)
      setAuthorityForm({})
    } catch (error) {
      console.error('Error saving authority:', error)
    }
  }

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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Approval Workflow Configuration</h2>
            <p className="text-gray-600 mt-1">Manage approval rules, authority matrix, and workflow templates</p>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
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
          {/* Approval Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Approval Rules</h3>
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
                  <div key={rule.id} className="border border-gray-200 rounded-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{rule.name}</h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-sm text-gray-500">Priority: {rule.priority}</span>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{rule.description}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Change Types:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.conditions.change_types.map(type => (
                                  <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700">Priority Levels:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.conditions.priority_levels.map(priority => (
                                  <span key={priority} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 capitalize">
                                    {priority}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-700">Cost Threshold:</span>
                              <div className="mt-1 text-gray-600">
                                {rule.conditions.cost_threshold_min && `Min: ${formatCurrency(rule.conditions.cost_threshold_min)}`}
                                {rule.conditions.cost_threshold_min && rule.conditions.cost_threshold_max && ' - '}
                                {rule.conditions.cost_threshold_max && `Max: ${formatCurrency(rule.conditions.cost_threshold_max)}`}
                                {!rule.conditions.cost_threshold_min && !rule.conditions.cost_threshold_max && 'No limit'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
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
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {expandedRules.has(rule.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded Rule Details */}
                      {expandedRules.has(rule.id) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="font-medium text-gray-900 mb-3">Approval Steps</h5>
                          <div className="space-y-3">
                            {rule.approval_steps.map((step, index) => (
                              <div key={step.id} className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-gray-900">
                                        Step {step.step_number}: {step.name}
                                      </span>
                                      {step.is_parallel && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-600">
                                          Parallel
                                        </span>
                                      )}
                                      {!step.is_required && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                          Optional
                                        </span>
                                      )}
                                    </div>
                                    
                                    {step.description && (
                                      <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                                      <div>
                                        <span className="font-medium">Approvers:</span>
                                        <div className="mt-1">
                                          {step.approver_roles.map(role => (
                                            <span key={role} className="inline-block mr-1 px-1 py-0.5 bg-white rounded border text-xs capitalize">
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
                                    <ArrowDown className="h-3 w-3 text-gray-400" />
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
                <h3 className="text-lg font-medium text-gray-900">Approval Authority Matrix</h3>
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
                  <div key={authority.id} className="border border-gray-200 rounded-lg">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 capitalize">
                              {authority.role.replace('_', ' ')}
                            </h4>
                            {authority.user_name && (
                              <span className="text-gray-600">- {authority.user_name}</span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              authority.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {authority.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-900">Cost Authority</span>
                              </div>
                              <p className="text-lg font-bold text-gray-900">
                                {formatCurrency(authority.max_cost_authority)}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">Schedule Authority</span>
                              </div>
                              <p className="text-lg font-bold text-gray-900">
                                {authority.max_schedule_authority_days} days
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium text-gray-900">Delegation</span>
                              </div>
                              <p className="text-sm text-gray-900">
                                {authority.can_delegate ? 'Can delegate' : 'Cannot delegate'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {authority.can_receive_delegations ? 'Can receive' : 'Cannot receive'}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="h-4 w-4 text-orange-600" />
                                <span className="text-sm font-medium text-gray-900">Change Types</span>
                              </div>
                              <p className="text-sm text-gray-900">
                                {authority.change_types_authorized.length} authorized
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Effective from: {new Date(authority.effective_from).toLocaleDateString()}</span>
                            {authority.effective_until && (
                              <span>Until: {new Date(authority.effective_until).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAuthorityExpansion(authority.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {expandedAuthorities.has(authority.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEditAuthority(authority)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAuthority(authority.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Expanded Authority Details */}
                      {expandedAuthorities.has(authority.id) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Authorized Change Types</h5>
                              <div className="flex flex-wrap gap-1">
                                {authority.change_types_authorized.map(type => (
                                  <span key={type} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Authorized Project Phases</h5>
                              <div className="flex flex-wrap gap-1">
                                {authority.project_phases_authorized.map(phase => (
                                  <span key={phase} className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800 capitalize">
                                    {phase}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {authority.backup_approvers.length > 0 && (
                              <div className="md:col-span-2">
                                <h5 className="font-medium text-gray-900 mb-2">Backup Approvers</h5>
                                <div className="flex flex-wrap gap-1">
                                  {authority.backup_approvers.map(backup => (
                                    <span key={backup} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
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
                <h3 className="text-lg font-medium text-gray-900">Workflow Templates</h3>
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
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {template.is_system_template && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            System
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Category:</span>
                        <span className="ml-2 text-sm text-gray-600">{template.category}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Steps:</span>
                        <span className="ml-2 text-sm text-gray-600">{template.default_steps.length}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Usage:</span>
                        <span className="ml-2 text-sm text-gray-600">{template.usage_count} times</span>
                      </div>
                      
                      {template.last_used && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Last used:</span>
                          <span className="ml-2 text-sm text-gray-600">
                            {new Date(template.last_used).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-sm font-medium text-gray-700 mb-2 block">Recommended for:</span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {template.recommended_for.change_types.map(type => (
                            <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                              {type}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.recommended_for.priority_levels.map(priority => (
                            <span key={priority} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 capitalize">
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
                          <button className="text-blue-600 hover:text-blue-800">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-800">
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingItem ? 'Edit Approval Rule' : 'Create Approval Rule'}
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name *</label>
                  <input
                    type="text"
                    value={ruleForm.name || ''}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter rule name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <input
                    type="number"
                    value={ruleForm.priority || 1}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={ruleForm.description || ''}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe when this rule should be applied"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={ruleForm.is_active || false}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active Rule
                </label>
              </div>
              
              {/* Additional form fields would go here for conditions and approval steps */}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
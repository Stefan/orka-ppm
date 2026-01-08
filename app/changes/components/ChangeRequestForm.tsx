'use client'

import React, { useState, useEffect } from 'react'
import { Save, X, Upload, FileText, Calculator, Info, Calendar, DollarSign, Clock } from 'lucide-react'

// Types based on the design document
interface ChangeRequestFormData {
  title: string
  description: string
  justification: string
  change_type: string
  priority: string
  project_id: string
  required_by_date: string
  estimated_cost_impact: number | null
  estimated_schedule_impact_days: number | null
  estimated_effort_hours: number | null
  affected_milestones: string[]
  affected_pos: string[]
  template_id: string
  template_data: Record<string, any>
}

interface ChangeTemplate {
  id: string
  name: string
  description: string
  change_type: string
  template_data: {
    fields: TemplateField[]
    validation_rules: Record<string, any>
    default_values: Record<string, any>
  }
}

interface TemplateField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'date' | 'checkbox' | 'file'
  required: boolean
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

interface Project {
  id: string
  name: string
  milestones: { id: string; name: string }[]
  purchase_orders: { id: string; number: string; description: string }[]
}

interface ChangeRequestFormProps {
  changeId?: string
  projectId?: string
  templateId?: string
  onSubmit: (data: ChangeRequestFormData) => void
  onCancel: () => void
  initialData?: Partial<ChangeRequestFormData>
}

const CHANGE_TYPES = [
  { value: '', label: 'Select Change Type' },
  { value: 'scope', label: 'Scope Change' },
  { value: 'schedule', label: 'Schedule Change' },
  { value: 'budget', label: 'Budget Change' },
  { value: 'design', label: 'Design Change' },
  { value: 'regulatory', label: 'Regulatory Change' },
  { value: 'resource', label: 'Resource Change' },
  { value: 'quality', label: 'Quality Change' },
  { value: 'safety', label: 'Safety Change' },
  { value: 'emergency', label: 'Emergency Change' }
]

const PRIORITY_LEVELS = [
  { value: '', label: 'Select Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
  { value: 'emergency', label: 'Emergency' }
]

export default function ChangeRequestForm({
  changeId,
  projectId,
  templateId,
  onSubmit,
  onCancel,
  initialData
}: ChangeRequestFormProps) {
  const [formData, setFormData] = useState<ChangeRequestFormData>({
    title: '',
    description: '',
    justification: '',
    change_type: '',
    priority: 'medium',
    project_id: projectId || '',
    required_by_date: '',
    estimated_cost_impact: null,
    estimated_schedule_impact_days: null,
    estimated_effort_hours: null,
    affected_milestones: [],
    affected_pos: [],
    template_id: templateId || '',
    template_data: {},
    ...initialData
  })

  const [templates, setTemplates] = useState<ChangeTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ChangeTemplate | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showImpactEstimator, setShowImpactEstimator] = useState(false)

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockTemplates: ChangeTemplate[] = [
      {
        id: 'template-1',
        name: 'Design Change Template',
        description: 'Template for design modifications',
        change_type: 'design',
        template_data: {
          fields: [
            {
              name: 'design_area',
              label: 'Design Area Affected',
              type: 'select',
              required: true,
              options: [
                { value: 'structural', label: 'Structural' },
                { value: 'architectural', label: 'Architectural' },
                { value: 'mechanical', label: 'Mechanical' },
                { value: 'electrical', label: 'Electrical' }
              ]
            },
            {
              name: 'drawing_numbers',
              label: 'Affected Drawing Numbers',
              type: 'textarea',
              required: true
            },
            {
              name: 'technical_justification',
              label: 'Technical Justification',
              type: 'textarea',
              required: true
            }
          ],
          validation_rules: {},
          default_values: {}
        }
      },
      {
        id: 'template-2',
        name: 'Budget Change Template',
        description: 'Template for budget modifications',
        change_type: 'budget',
        template_data: {
          fields: [
            {
              name: 'budget_category',
              label: 'Budget Category',
              type: 'select',
              required: true,
              options: [
                { value: 'materials', label: 'Materials' },
                { value: 'labor', label: 'Labor' },
                { value: 'equipment', label: 'Equipment' },
                { value: 'overhead', label: 'Overhead' }
              ]
            },
            {
              name: 'cost_breakdown',
              label: 'Detailed Cost Breakdown',
              type: 'textarea',
              required: true
            }
          ],
          validation_rules: {},
          default_values: {}
        }
      }
    ]

    const mockProjects: Project[] = [
      {
        id: 'proj-1',
        name: 'Office Complex Phase 1',
        milestones: [
          { id: 'ms-1', name: 'Foundation Complete' },
          { id: 'ms-2', name: 'Structure Complete' },
          { id: 'ms-3', name: 'MEP Installation' }
        ],
        purchase_orders: [
          { id: 'po-1', number: 'PO-2024-001', description: 'Concrete Supply' },
          { id: 'po-2', number: 'PO-2024-002', description: 'Steel Structure' }
        ]
      }
    ]

    setTemplates(mockTemplates)
    setProjects(mockProjects)

    if (projectId) {
      const project = mockProjects.find(p => p.id === projectId)
      setSelectedProject(project || null)
    }

    if (templateId) {
      const template = mockTemplates.find(t => t.id === templateId)
      setSelectedTemplate(template || null)
    }
  }, [projectId, templateId])

  const handleInputChange = (field: keyof ChangeRequestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    setSelectedTemplate(template || null)
    setFormData(prev => ({
      ...prev,
      template_id: templateId,
      change_type: template?.change_type || prev.change_type,
      template_data: template?.template_data.default_values || {}
    }))
  }

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    setSelectedProject(project || null)
    setFormData(prev => ({
      ...prev,
      project_id: projectId,
      affected_milestones: [],
      affected_pos: []
    }))
  }

  const handleTemplateFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      template_data: {
        ...prev.template_data,
        [fieldName]: value
      }
    }))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }

    if (!formData.change_type) {
      newErrors.change_type = 'Change type is required'
    }

    if (!formData.priority) {
      newErrors.priority = 'Priority is required'
    }

    if (!formData.project_id) {
      newErrors.project_id = 'Project selection is required'
    }

    // Validate template fields if template is selected
    if (selectedTemplate) {
      selectedTemplate.template_data.fields.forEach(field => {
        if (field.required && !formData.template_data[field.name]) {
          newErrors[`template_${field.name}`] = `${field.label} is required`
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderTemplateField = (field: TemplateField) => {
    const value = formData.template_data[field.name] || ''
    const error = errors[`template_${field.name}`]

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.name, e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.label}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.name, e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.label}
          />
        )

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.name, e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.name, parseFloat(e.target.value) || 0)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.label}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleTemplateFieldChange(field.name, e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        )

      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleTemplateFieldChange(field.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {changeId ? 'Edit Change Request' : 'New Change Request'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Brief description of the change"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
              Project *
            </label>
            <select
              id="project"
              value={formData.project_id}
              onChange={(e) => handleProjectChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.project_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.project_id && (
              <p className="mt-1 text-sm text-red-600">{errors.project_id}</p>
            )}
          </div>

          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-2">
              Template
            </label>
            <select
              id="template"
              value={formData.template_id}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Template (Optional)</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="change-type" className="block text-sm font-medium text-gray-700 mb-2">
              Change Type *
            </label>
            <select
              id="change-type"
              value={formData.change_type}
              onChange={(e) => handleInputChange('change_type', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.change_type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {CHANGE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.change_type && (
              <p className="mt-1 text-sm text-red-600">{errors.change_type}</p>
            )}
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority *
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.priority ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {PRIORITY_LEVELS.map(priority => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600">{errors.priority}</p>
            )}
          </div>
        </div>

        {/* Description and Justification */}
        <div className="space-y-4">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Detailed description of the proposed change"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justification
            </label>
            <textarea
              value={formData.justification}
              onChange={(e) => handleInputChange('justification', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Business justification for this change"
            />
          </div>
        </div>

        {/* Template-specific fields */}
        {selectedTemplate && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedTemplate.name} Fields
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedTemplate.template_data.fields.map(field => (
                <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label} {field.required && '*'}
                  </label>
                  {renderTemplateField(field)}
                  {errors[`template_${field.name}`] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[`template_${field.name}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impact Estimation */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Impact Estimation</h3>
            <button
              type="button"
              onClick={() => setShowImpactEstimator(!showImpactEstimator)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <Calculator className="h-4 w-4" />
              {showImpactEstimator ? 'Hide' : 'Show'} Impact Calculator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Estimated Cost Impact ($)
              </label>
              <input
                type="number"
                value={formData.estimated_cost_impact || ''}
                onChange={(e) => handleInputChange('estimated_cost_impact', parseFloat(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Schedule Impact (Days)
              </label>
              <input
                type="number"
                value={formData.estimated_schedule_impact_days || ''}
                onChange={(e) => handleInputChange('estimated_schedule_impact_days', parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Effort Hours
              </label>
              <input
                type="number"
                value={formData.estimated_effort_hours || ''}
                onChange={(e) => handleInputChange('estimated_effort_hours', parseFloat(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required By Date
            </label>
            <input
              type="date"
              value={formData.required_by_date}
              onChange={(e) => handleInputChange('required_by_date', e.target.value)}
              className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Project Linkages */}
        {selectedProject && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Project Linkages</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Affected Milestones
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {selectedProject.milestones.map(milestone => (
                    <label key={milestone.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.affected_milestones.includes(milestone.id)}
                        onChange={(e) => {
                          const milestones = e.target.checked
                            ? [...formData.affected_milestones, milestone.id]
                            : formData.affected_milestones.filter(id => id !== milestone.id)
                          handleInputChange('affected_milestones', milestones)
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{milestone.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Affected Purchase Orders
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {selectedProject.purchase_orders.map(po => (
                    <label key={po.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.affected_pos.includes(po.id)}
                        onChange={(e) => {
                          const pos = e.target.checked
                            ? [...formData.affected_pos, po.id]
                            : formData.affected_pos.filter(id => id !== po.id)
                          handleInputChange('affected_pos', pos)
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {po.number} - {po.description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Attachments */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Attachments</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Documents
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PDF, DOC, XLS, IMG files (MAX. 10MB)</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    aria-label="Upload documents"
                  />
                </label>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Attached Files:</h4>
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span>Fields marked with * are required</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {loading ? 'Saving...' : (changeId ? 'Update' : 'Create')} Change Request
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
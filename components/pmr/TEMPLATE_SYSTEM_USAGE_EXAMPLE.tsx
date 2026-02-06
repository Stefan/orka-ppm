/**
 * PMR Template System - Usage Example
 * 
 * This file demonstrates how to integrate the PMR Template System
 * into your application. Copy and adapt this code for your use case.
 */

'use client'

import React, { useState } from 'react'
import {
  PMRTemplateSelector,
  PMRTemplatePreview,
  PMRTemplateCustomizer,
  PMRTemplate
} from '@/components/pmr'
import { usePMRTemplates } from '@/hooks/usePMRTemplates'

/**
 * Example 1: Basic Template Selection
 * 
 * Minimal implementation showing template selection only
 */
export function BasicTemplateSelection() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  
  const { templates, isLoading } = usePMRTemplates({
    autoFetch: true
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Select a Template</h1>
      <PMRTemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        isLoading={isLoading}
      />
      {selectedTemplateId && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300">
            Selected template: {selectedTemplateId}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Example 2: Template Selection with AI Suggestions
 * 
 * Shows how to leverage AI suggestions based on project context
 */
export function AIAssistedTemplateSelection() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  
  // These would typically come from your project context
  const projectType = 'executive'
  const industryFocus = 'construction'
  
  const { templates, isLoading } = usePMRTemplates({
    projectType,
    industryFocus,
    autoFetch: true
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">AI-Assisted Template Selection</h1>
        <p className="text-gray-600 dark:text-slate-400">
          Project Type: {projectType} | Industry: {industryFocus}
        </p>
      </div>
      <PMRTemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        projectType={projectType}
        industryFocus={industryFocus}
        onSelectTemplate={setSelectedTemplateId}
        isLoading={isLoading}
      />
    </div>
  )
}

/**
 * Example 3: Full Template Management
 * 
 * Complete implementation with preview, customization, and rating
 */
export function FullTemplateManagement() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [previewTemplate, setPreviewTemplate] = useState<PMRTemplate | null>(null)
  const [customizeTemplate, setCustomizeTemplate] = useState<PMRTemplate | null>(null)

  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    rateTemplate,
    getAISuggestions
  } = usePMRTemplates({
    projectType: 'executive',
    industryFocus: 'construction',
    autoFetch: true
  })

  const handlePreviewTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setPreviewTemplate(template)
    }
  }

  const handleCustomizeTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setCustomizeTemplate(template)
    }
  }

  const handleSaveCustomization = async (customized: Partial<PMRTemplate>) => {
    if (customizeTemplate) {
      try {
        await updateTemplate(customizeTemplate.id, customized)
        setCustomizeTemplate(null)
        alert('Template customization saved successfully!')
      } catch (error) {
        console.error('Failed to save customization:', error)
        alert('Failed to save customization. Please try again.')
      }
    }
  }

  const handleGetAISuggestions = async (context: any) => {
    if (customizeTemplate) {
      try {
        return await getAISuggestions(customizeTemplate.id)
      } catch (error) {
        console.error('Failed to get AI suggestions:', error)
        throw error
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            PMR Template Management
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Select, preview, customize, and rate templates for your reports
          </p>
        </div>

        {/* Template Selector */}
        <PMRTemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          projectType="executive"
          industryFocus="construction"
          onSelectTemplate={setSelectedTemplateId}
          onCreateTemplate={async (template) => {
            try {
              await createTemplate(template)
              alert('Template created successfully!')
            } catch (error) {
              console.error('Failed to create template:', error)
              alert('Failed to create template. Please try again.')
            }
          }}
          onUpdateTemplate={async (templateId, updates) => {
            try {
              await updateTemplate(templateId, updates)
              alert('Template updated successfully!')
            } catch (error) {
              console.error('Failed to update template:', error)
              alert('Failed to update template. Please try again.')
            }
          }}
          onDeleteTemplate={async (templateId) => {
            if (confirm('Are you sure you want to delete this template?')) {
              try {
                await deleteTemplate(templateId)
                alert('Template deleted successfully!')
              } catch (error) {
                console.error('Failed to delete template:', error)
                alert('Failed to delete template. Please try again.')
              }
            }
          }}
          onRateTemplate={async (templateId, rating) => {
            try {
              await rateTemplate(templateId, rating)
              alert('Rating submitted successfully!')
            } catch (error) {
              console.error('Failed to rate template:', error)
              alert('Failed to submit rating. Please try again.')
            }
          }}
          onPreviewTemplate={handlePreviewTemplate}
          onCustomizeTemplate={handleCustomizeTemplate}
          isLoading={isLoading}
          className="mb-8"
        />

        {/* Selected Template Actions */}
        {selectedTemplateId && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Next Steps
            </h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // This would typically trigger report generation
                  console.log('Generate report with template:', selectedTemplateId)
                  alert(`Generating report with template: ${selectedTemplateId}`)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate Report
              </button>
              <button
                onClick={() => handlePreviewTemplate(selectedTemplateId)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Preview Template
              </button>
              <button
                onClick={() => handleCustomizeTemplate(selectedTemplateId)}
                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 transition-colors"
              >
                Customize Template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <PMRTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onSelect={() => {
            setSelectedTemplateId(previewTemplate.id)
            setPreviewTemplate(null)
          }}
          onCustomize={() => {
            setCustomizeTemplate(previewTemplate)
            setPreviewTemplate(null)
          }}
        />
      )}

      {/* Customizer Modal */}
      {customizeTemplate && (
        <PMRTemplateCustomizer
          template={customizeTemplate}
          onSave={handleSaveCustomization}
          onClose={() => setCustomizeTemplate(null)}
          onGetAISuggestions={handleGetAISuggestions}
        />
      )}
    </div>
  )
}

/**
 * Example 4: Template Selection in a Form
 * 
 * Shows how to integrate template selection into a larger form
 */
export function TemplateSelectionInForm() {
  const [formData, setFormData] = useState({
    projectId: '',
    reportMonth: '',
    reportYear: new Date().getFullYear(),
    templateId: '',
    title: ''
  })

  const { templates, isLoading } = usePMRTemplates({
    autoFetch: true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
    // Handle form submission
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New PMR Report</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Other form fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Project ID
          </label>
          <input
            type="text"
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Report Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
            required
          />
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Select Template
          </label>
          <PMRTemplateSelector
            templates={templates}
            selectedTemplateId={formData.templateId}
            onSelectTemplate={(templateId) => 
              setFormData({ ...formData, templateId })
            }
            isLoading={isLoading}
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => setFormData({
              projectId: '',
              reportMonth: '',
              reportYear: new Date().getFullYear(),
              templateId: '',
              title: ''
            })}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!formData.templateId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Create Report
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Example 5: Custom Template Creation
 * 
 * Shows how to create a new template from scratch
 */
export function CustomTemplateCreation() {
  const { createTemplate } = usePMRTemplates()

  const handleCreateCustomTemplate = async () => {
    try {
      const newTemplate = await createTemplate({
        name: 'My Custom Template',
        description: 'A custom template for my specific needs',
        template_type: 'custom',
        industry_focus: 'construction',
        sections: [
          {
            section_id: 'executive-summary',
            title: 'Executive Summary',
            description: 'High-level overview of the project',
            required: true,
            ai_suggestions: {}
          },
          {
            section_id: 'budget-analysis',
            title: 'Budget Analysis',
            description: 'Detailed budget breakdown and variance analysis',
            required: true,
            ai_suggestions: {}
          }
        ],
        default_metrics: [
          'Budget Variance',
          'Schedule Performance Index',
          'Cost Performance Index'
        ],
        ai_suggestions: {},
        branding_config: {},
        export_formats: ['pdf', 'excel'],
        is_public: false
      })

      alert(`Template created with ID: ${newTemplate.id}`)
    } catch (error) {
      console.error('Failed to create template:', error)
      alert('Failed to create template. Please try again.')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Create Custom Template</h1>
      <button
        onClick={handleCreateCustomTemplate}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Create Template
      </button>
    </div>
  )
}

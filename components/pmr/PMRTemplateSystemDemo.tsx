'use client'

import React, { useState } from 'react'
import PMRTemplateSelector from './PMRTemplateSelector'
import PMRTemplatePreview from './PMRTemplatePreview'
import PMRTemplateCustomizer from './PMRTemplateCustomizer'
import { usePMRTemplates } from '@/hooks/usePMRTemplates'
import { PMRTemplate } from './types'

/**
 * Demo component showing how to integrate the PMR Template System
 * This demonstrates the complete workflow:
 * 1. Template selection with AI suggestions
 * 2. Template preview
 * 3. Template customization
 * 4. Template rating and feedback
 */
export default function PMRTemplateSystemDemo() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>()
  const [previewTemplate, setPreviewTemplate] = useState<PMRTemplate | null>(null)
  const [customizeTemplate, setCustomizeTemplate] = useState<PMRTemplate | null>(null)

  // Use the PMR templates hook
  const {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    rateTemplate,
    getAISuggestions
  } = usePMRTemplates({
    projectType: 'executive', // Example: could come from project context
    industryFocus: 'construction', // Example: could come from project context
    autoFetch: true
  })

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    console.log('Selected template:', templateId)
  }

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

  const handleCreateTemplate = async (template: Partial<PMRTemplate>) => {
    try {
      await createTemplate(template)
      console.log('Template created successfully')
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const handleUpdateTemplate = async (templateId: string, updates: Partial<PMRTemplate>) => {
    try {
      await updateTemplate(templateId, updates)
      console.log('Template updated successfully')
    } catch (error) {
      console.error('Failed to update template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(templateId)
        console.log('Template deleted successfully')
      } catch (error) {
        console.error('Failed to delete template:', error)
      }
    }
  }

  const handleRateTemplate = async (templateId: string, rating: number) => {
    try {
      await rateTemplate(templateId, rating)
      console.log('Template rated successfully')
    } catch (error) {
      console.error('Failed to rate template:', error)
    }
  }

  const handleSaveCustomization = async (customizedTemplate: Partial<PMRTemplate>) => {
    if (customizeTemplate) {
      try {
        await updateTemplate(customizeTemplate.id, customizedTemplate)
        setCustomizeTemplate(null)
        console.log('Template customization saved')
      } catch (error) {
        console.error('Failed to save customization:', error)
      }
    }
  }

  const handleGetAISuggestions = async (context: any) => {
    if (customizeTemplate) {
      try {
        const suggestions = await getAISuggestions(customizeTemplate.id)
        return suggestions
      } catch (error) {
        console.error('Failed to get AI suggestions:', error)
        throw error
      }
    }
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-2">Error loading templates</div>
        <div className="text-sm text-gray-600">{error.message}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PMR Template System Demo
          </h1>
          <p className="text-gray-600">
            Select, preview, and customize templates for your Project Monthly Reports
          </p>
        </div>

        {/* Template Selector */}
        <PMRTemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          projectType="executive"
          industryFocus="construction"
          onSelectTemplate={handleSelectTemplate}
          onCreateTemplate={handleCreateTemplate}
          onUpdateTemplate={handleUpdateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onRateTemplate={handleRateTemplate}
          onPreviewTemplate={handlePreviewTemplate}
          onCustomizeTemplate={handleCustomizeTemplate}
          isLoading={isLoading}
          className="mb-8"
        />

        {/* Selected Template Info */}
        {selectedTemplateId && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Selected Template
            </h2>
            <p className="text-sm text-gray-600">
              Template ID: {selectedTemplateId}
            </p>
            <div className="mt-4">
              <button
                onClick={() => {
                  // This would typically trigger report generation
                  console.log('Generate report with template:', selectedTemplateId)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate Report with This Template
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
            handleSelectTemplate(previewTemplate.id)
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

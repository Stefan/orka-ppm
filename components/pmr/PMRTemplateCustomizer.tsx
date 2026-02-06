'use client'

import React, { useState, useCallback } from 'react'
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { PMRTemplate } from './types'

export interface PMRTemplateCustomizerProps {
  template: PMRTemplate
  onSave: (customizedTemplate: Partial<PMRTemplate>) => Promise<void>
  onClose: () => void
  onGetAISuggestions?: (context: any) => Promise<any>
}

interface TemplateSection {
  section_id: string
  title: string
  description?: string
  required: boolean
  ai_suggestions?: Record<string, any>
}

const PMRTemplateCustomizer: React.FC<PMRTemplateCustomizerProps> = ({
  template,
  onSave,
  onClose,
  onGetAISuggestions
}) => {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description || '')
  const [sections, setSections] = useState<TemplateSection[]>(template.sections)
  const [defaultMetrics, setDefaultMetrics] = useState<string[]>(template.default_metrics)
  const [newMetric, setNewMetric] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  const handleAddSection = useCallback(() => {
    const newSection: TemplateSection = {
      section_id: `section_${Date.now()}`,
      title: 'New Section',
      description: '',
      required: false,
      ai_suggestions: {}
    }
    setSections(prev => [...prev, newSection])
  }, [])

  const handleRemoveSection = useCallback((sectionId: string) => {
    setSections(prev => prev.filter(s => s.section_id !== sectionId))
  }, [])

  const handleUpdateSection = useCallback((
    sectionId: string,
    updates: Partial<TemplateSection>
  ) => {
    setSections(prev => prev.map(s => 
      s.section_id === sectionId ? { ...s, ...updates } : s
    ))
  }, [])

  const handleAddMetric = useCallback(() => {
    if (newMetric.trim()) {
      setDefaultMetrics(prev => [...prev, newMetric.trim()])
      setNewMetric('')
    }
  }, [newMetric])

  const handleRemoveMetric = useCallback((index: number) => {
    setDefaultMetrics(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleGetAISuggestions = useCallback(async () => {
    if (!onGetAISuggestions) return

    setIsLoadingAI(true)
    try {
      const suggestions = await onGetAISuggestions({
        template_type: template.template_type,
        industry_focus: template.industry_focus,
        current_sections: sections
      })

      // Apply AI suggestions to sections
      if (suggestions.suggested_sections) {
        setSections(prev => [...prev, ...suggestions.suggested_sections])
      }
      if (suggestions.suggested_metrics) {
        setDefaultMetrics(prev => [...prev, ...suggestions.suggested_metrics])
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
    } finally {
      setIsLoadingAI(false)
    }
  }, [onGetAISuggestions, template, sections])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave({
        name,
        description,
        sections,
        default_metrics: defaultMetrics
      })
      onClose()
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setIsSaving(false)
    }
  }, [name, description, sections, defaultMetrics, onSave, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Customize Template</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Modify sections, metrics, and settings to create your perfect template
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter template name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe this template"
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Template Sections</h3>
              <div className="flex items-center space-x-2">
                {onGetAISuggestions && (
                  <button
                    onClick={handleGetAISuggestions}
                    disabled={isLoadingAI}
                    className="flex items-center space-x-1 px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className={`h-4 w-4 ${isLoadingAI ? 'animate-spin' : ''}`} />
                    <span>AI Suggestions</span>
                  </button>
                )}
                <button
                  onClick={handleAddSection}
                  className="flex items-center space-x-1 px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Section</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div
                  key={section.section_id}
                  className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-2 cursor-move">
                      <GripVertical className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start space-x-3">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => handleUpdateSection(section.section_id, { title: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Section title"
                        />
                        <button
                          onClick={() => handleRemoveSection(section.section_id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={section.description || ''}
                        onChange={(e) => handleUpdateSection(section.section_id, { description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Section description (optional)"
                      />
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={section.required}
                          onChange={(e) => handleUpdateSection(section.section_id, { required: e.target.checked })}
                          className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">Required section</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-slate-400">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">No sections added yet</p>
                  <button
                    onClick={handleAddSection}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Add your first section
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Default Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Default Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMetric}
                  onChange={(e) => setNewMetric(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMetric()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add a metric (e.g., Budget Variance)"
                />
                <button
                  onClick={handleAddMetric}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {defaultMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm text-gray-900 dark:text-slate-100">{metric}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMetric(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || sections.length === 0}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving && <Save className="h-4 w-4 animate-pulse" />}
              <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PMRTemplateCustomizer

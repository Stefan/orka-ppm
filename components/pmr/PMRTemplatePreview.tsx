'use client'

import React from 'react'
import { X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { PMRTemplate } from './types'

export interface PMRTemplatePreviewProps {
  template: PMRTemplate
  onClose: () => void
  onSelect?: () => void
  onCustomize?: () => void
}

const PMRTemplatePreview: React.FC<PMRTemplatePreviewProps> = ({
  template,
  onClose,
  onSelect,
  onCustomize
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{template.name}</h2>
              <p className="text-sm text-gray-600">{template.description}</p>
              <div className="flex items-center space-x-3 mt-3">
                <span className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full capitalize">
                  {template.template_type}
                </span>
                {template.industry_focus && (
                  <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                    {template.industry_focus}
                  </span>
                )}
                {template.is_public && (
                  <span className="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
                    Public Template
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Template Sections */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Sections</h3>
            <div className="space-y-3">
              {template.sections.map((section, index) => (
                <div
                  key={section.section_id}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {index + 1}. {section.title}
                        </span>
                        {section.required && (
                          <span className="flex items-center space-x-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>Required</span>
                          </span>
                        )}
                      </div>
                      {section.description && (
                        <p className="text-xs text-gray-600">{section.description}</p>
                      )}
                      {section.ai_suggestions && Object.keys(section.ai_suggestions).length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-700">
                            ✨ AI suggestions available for this section
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Default Metrics */}
          {template.default_metrics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {template.default_metrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-900">{metric}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Formats */}
          {template.export_formats.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Export Formats</h3>
              <div className="flex flex-wrap gap-2">
                {template.export_formats.map((format, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-full uppercase"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {template.ai_suggestions && Object.keys(template.ai_suggestions).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Capabilities</h3>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  This template includes AI-powered suggestions and recommendations to help you create
                  comprehensive reports faster.
                </p>
              </div>
            </div>
          )}

          {/* Branding Config */}
          {template.branding_config && Object.keys(template.branding_config).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  This template includes custom branding configuration for consistent organization styling.
                </p>
              </div>
            </div>
          )}

          {/* Usage Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{template.usage_count}</div>
              <div className="text-xs text-gray-500">Times Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {template.rating?.toFixed(1) || 'N/A'}
              </div>
              <div className="text-xs text-gray-500">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{template.sections.length}</div>
              <div className="text-xs text-gray-500">Sections</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {onCustomize && (
              <button
                onClick={onCustomize}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Customize Template
              </button>
            )}
            {onSelect && (
              <button
                onClick={onSelect}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Use This Template
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PMRTemplatePreview

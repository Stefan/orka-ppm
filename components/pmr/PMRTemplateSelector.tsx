'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  FileText,
  Star,
  TrendingUp,
  Building2,
  Sparkles,
  Search,
  Filter,
  Eye,
  Edit,
  Copy,
  Trash2,
  Plus,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  Loader2,
  Download,
  Upload
} from 'lucide-react'
import { PMRTemplate } from './types'

export interface PMRTemplateSelectorProps {
  templates: PMRTemplate[]
  selectedTemplateId?: string
  projectType?: string
  industryFocus?: string
  onSelectTemplate: (templateId: string) => void
  onCreateTemplate?: (template: Partial<PMRTemplate>) => Promise<void>
  onUpdateTemplate?: (templateId: string, updates: Partial<PMRTemplate>) => Promise<void>
  onDeleteTemplate?: (templateId: string) => Promise<void>
  onRateTemplate?: (templateId: string, rating: number) => Promise<void>
  onPreviewTemplate?: (templateId: string) => void
  onCustomizeTemplate?: (templateId: string) => void
  isLoading?: boolean
  className?: string
}

interface TemplateFilters {
  search: string
  types: string[]
  industries: string[]
  minRating: number
  showPublicOnly: boolean
  showAISuggested: boolean
}

const PMRTemplateSelector: React.FC<PMRTemplateSelectorProps> = ({
  templates,
  selectedTemplateId,
  projectType,
  industryFocus,
  onSelectTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onRateTemplate,
  onPreviewTemplate,
  onCustomizeTemplate,
  isLoading = false,
  className = ''
}) => {
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    types: [],
    industries: [],
    minRating: 0,
    showPublicOnly: false,
    showAISuggested: false
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState<string | null>(null)
  const [aiSuggestedTemplates, setAiSuggestedTemplates] = useState<string[]>([])

  // Get AI-suggested templates based on project type and industry
  useEffect(() => {
    if (projectType || industryFocus) {
      const suggested = templates
        .filter(template => {
          const matchesType = projectType && template.template_type === projectType
          const matchesIndustry = industryFocus && template.industry_focus === industryFocus
          return matchesType || matchesIndustry
        })
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 3)
        .map(t => t.id)
      
      setAiSuggestedTemplates(suggested)
    }
  }, [projectType, industryFocus, templates])

  // Filter templates based on current filters
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesSearch = 
          template.name.toLowerCase().includes(searchLower) ||
          template.description?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(template.template_type)) {
        return false
      }

      // Industry filter
      if (filters.industries.length > 0) {
        if (!template.industry_focus || !filters.industries.includes(template.industry_focus)) {
          return false
        }
      }

      // Rating filter
      if (template.rating && template.rating < filters.minRating) {
        return false
      }

      // Public only filter
      if (filters.showPublicOnly && !template.is_public) {
        return false
      }

      // AI suggested filter
      if (filters.showAISuggested && !aiSuggestedTemplates.includes(template.id)) {
        return false
      }

      return true
    })
  }, [templates, filters, aiSuggestedTemplates])

  // Group templates by type
  const templatesByType = useMemo(() => {
    const grouped: Record<string, PMRTemplate[]> = {}
    filteredTemplates.forEach(template => {
      if (!grouped[template.template_type]) {
        grouped[template.template_type] = []
      }
      grouped[template.template_type]!.push(template)
    })
    return grouped
  }, [filteredTemplates])

  const handleSelectTemplate = useCallback((templateId: string) => {
    onSelectTemplate(templateId)
  }, [onSelectTemplate])

  const handleRateTemplate = useCallback(async (templateId: string, rating: number) => {
    if (onRateTemplate) {
      await onRateTemplate(templateId, rating)
      setShowRatingModal(null)
    }
  }, [onRateTemplate])

  const getTemplateTypeIcon = (type: string) => {
    switch (type) {
      case 'executive':
        return <TrendingUp className="h-4 w-4" />
      case 'technical':
        return <FileText className="h-4 w-4" />
      case 'financial':
        return <Building2 className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const renderTemplateCard = (template: PMRTemplate) => {
    const isSelected = selectedTemplateId === template.id
    const isAISuggested = aiSuggestedTemplates.includes(template.id)

    return (
      <div
        key={template.id}
        className={`relative bg-white dark:bg-slate-800 border-2 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow-md ${
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'
        }`}
        onClick={() => handleSelectTemplate(template.id)}
      >
        {/* AI Suggested Badge */}
        {isAISuggested && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-medium rounded-full">
              <Sparkles className="h-3 w-3" />
              <span>AI Suggested</span>
            </div>
          </div>
        )}

        {/* Selected Indicator */}
        {isSelected && (
          <div className="absolute top-2 left-2 z-10">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full">
              <Check className="h-4 w-4" />
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                {getTemplateTypeIcon(template.template_type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate mb-1">
                  {template.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
                  {template.description || 'No description available'}
                </p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-full capitalize">
                {template.template_type}
              </span>
              {template.industry_focus && (
                <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 rounded-full">
                  {template.industry_focus}
                </span>
              )}
            </div>
            {template.is_public && (
              <span className="text-xs text-gray-500 dark:text-slate-400">Public</span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-3">
            <div className="flex items-center space-x-1">
              <Star className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
              <span>{template.rating?.toFixed(1) || 'N/A'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Download className="h-3 w-3" />
              <span>{template.usage_count} uses</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className="h-3 w-3" />
              <span>{template.sections.length} sections</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 pt-3 border-t border-gray-200 dark:border-slate-700">
            {onPreviewTemplate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewTemplate(template.id)
                }}
                className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </button>
            )}
            {onCustomizeTemplate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCustomizeTemplate(template.id)
                }}
                className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-md hover:bg-blue-200 transition-colors"
              >
                <Edit className="h-3 w-3" />
                <span>Customize</span>
              </button>
            )}
            {onRateTemplate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowRatingModal(template.id)
                }}
                className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 rounded-md hover:bg-yellow-200 transition-colors"
              >
                <Star className="h-3 w-3" />
                <span>Rate</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Select Template</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:text-slate-400'
              }`}
              title="Toggle filters"
            >
              <Filter className="h-4 w-4" />
            </button>
            {onCreateTemplate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Template</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 space-y-3">
          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Template Type</label>
            <div className="flex flex-wrap gap-2">
              {['executive', 'technical', 'financial', 'custom'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      types: prev.types.includes(type)
                        ? prev.types.filter(t => t !== type)
                        : [...prev.types, type]
                    }))
                  }}
                  className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                    filters.types.includes(type)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Minimum Rating: {filters.minRating} stars
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={filters.minRating}
              onChange={(e) => setFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Toggle Filters */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showPublicOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, showPublicOnly: e.target.checked }))}
                className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700 dark:text-slate-300">Public only</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showAISuggested}
                onChange={(e) => setFilters(prev => ({ ...prev, showAISuggested: e.target.checked }))}
                className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700 dark:text-slate-300">AI suggested only</span>
            </label>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => setFilters({
              search: '',
              types: [],
              industries: [],
              minRating: 0,
              showPublicOnly: false,
              showAISuggested: false
            })}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* AI Suggestions Section */}
      {aiSuggestedTemplates.length > 0 && !filters.showAISuggested && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">AI Recommended for Your Project</h4>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
            Based on your project type{industryFocus && ' and industry'}, we recommend these templates:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates
              .filter(t => aiSuggestedTemplates.includes(t.id))
              .map(template => (
                <div
                  key={template.id}
                  className="p-3 bg-white dark:bg-slate-800 border border-purple-200 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{template.name}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />
                    <span className="text-xs text-gray-600 dark:text-slate-400">{template.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">•</span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">{template.usage_count} uses</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2 text-gray-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading templates...</span>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-slate-400">
            <FileText className="h-8 w-8 mb-2" />
            <p className="text-sm">No templates found</p>
            {onCreateTemplate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Create your first template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(templatesByType).map(([type, typeTemplates]) => (
              <div key={type}>
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 capitalize mb-3">
                  {type} Templates ({typeTemplates.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {typeTemplates.map(renderTemplateCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <RatingModal
          templateId={showRatingModal}
          onRate={handleRateTemplate}
          onClose={() => setShowRatingModal(null)}
        />
      )}
    </div>
  )
}

// Rating Modal Component
interface RatingModalProps {
  templateId: string
  onRate: (templateId: string, rating: number) => Promise<void>
  onClose: () => void
}

const RatingModal: React.FC<RatingModalProps> = ({ templateId, onRate, onClose }) => {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return
    
    setIsSubmitting(true)
    try {
      await onRate(templateId, rating)
      onClose()
    } catch (error) {
      console.error('Failed to submit rating:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Rate Template</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              How would you rate this template?
            </p>
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Feedback (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your thoughts about this template..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Submit Rating</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PMRTemplateSelector

import { useState, useCallback, useEffect } from 'react'
import { get, post, put, del } from '@/lib/api'
import { PMRTemplate } from '@/components/pmr/types'

interface UsePMRTemplatesOptions {
  projectType?: string
  industryFocus?: string
  autoFetch?: boolean
}

interface UsePMRTemplatesReturn {
  templates: PMRTemplate[]
  isLoading: boolean
  error: Error | null
  fetchTemplates: () => Promise<void>
  createTemplate: (template: Partial<PMRTemplate>) => Promise<PMRTemplate>
  updateTemplate: (templateId: string, updates: Partial<PMRTemplate>) => Promise<PMRTemplate>
  deleteTemplate: (templateId: string) => Promise<void>
  rateTemplate: (templateId: string, rating: number) => Promise<void>
  getAISuggestions: (templateId: string) => Promise<any>
}

export function usePMRTemplates(options: UsePMRTemplatesOptions = {}): UsePMRTemplatesReturn {
  const { projectType, industryFocus, autoFetch = true } = options
  
  const [templates, setTemplates] = useState<PMRTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (projectType) params.append('template_type', projectType)
      if (industryFocus) params.append('industry', industryFocus)
      
      const endpoint = `/reports/pmr/templates${params.toString() ? `?${params.toString()}` : ''}`
      const response = await get<PMRTemplate[]>(endpoint)
      
      setTemplates(response.data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch templates')
      setError(error)
      console.error('Error fetching PMR templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectType, industryFocus])

  const createTemplate = useCallback(async (template: Partial<PMRTemplate>): Promise<PMRTemplate> => {
    setError(null)
    
    try {
      const response = await post<PMRTemplate>('/reports/pmr/templates', template)
      const newTemplate = response.data
      
      setTemplates(prev => [...prev, newTemplate])
      return newTemplate
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create template')
      setError(error)
      throw error
    }
  }, [])

  const updateTemplate = useCallback(async (
    templateId: string,
    updates: Partial<PMRTemplate>
  ): Promise<PMRTemplate> => {
    setError(null)
    
    try {
      const response = await put<PMRTemplate>(`/reports/pmr/templates/${templateId}`, updates)
      const updatedTemplate = response.data
      
      setTemplates(prev => prev.map(t => t.id === templateId ? updatedTemplate : t))
      return updatedTemplate
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update template')
      setError(error)
      throw error
    }
  }, [])

  const deleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    setError(null)
    
    try {
      await del(`/reports/pmr/templates/${templateId}`)
      setTemplates(prev => prev.filter(t => t.id !== templateId))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete template')
      setError(error)
      throw error
    }
  }, [])

  const rateTemplate = useCallback(async (templateId: string, rating: number): Promise<void> => {
    setError(null)
    
    try {
      await post(`/reports/pmr/templates/${templateId}/rate`, { rating })
      
      // Update local state optimistically
      setTemplates(prev => prev.map(t => {
        if (t.id === templateId) {
          return {
            ...t,
            rating: rating,
            usage_count: t.usage_count + 1
          }
        }
        return t
      }))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to rate template')
      setError(error)
      throw error
    }
  }, [])

  const getAISuggestions = useCallback(async (templateId: string): Promise<any> => {
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (projectType) params.append('project_type', projectType)
      
      const endpoint = `/reports/pmr/templates/${templateId}/ai-suggestions${
        params.toString() ? `?${params.toString()}` : ''
      }`
      const response = await get(endpoint)
      
      return response.data
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get AI suggestions')
      setError(error)
      throw error
    }
  }, [projectType])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchTemplates()
    }
  }, [autoFetch, fetchTemplates])

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    rateTemplate,
    getAISuggestions
  }
}

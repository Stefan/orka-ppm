/**
 * Language management hook for multi-language support
 * 
 * This is a wrapper around the core i18n system that provides additional
 * functionality for help-chat API integration and utilities.
 * 
 * The core i18n system (lib/i18n/context.tsx) is the single source of truth
 * for language state and persistence.
 */

import { useState, useEffect, useCallback } from 'react'
import { helpChatAPI } from '@/lib/help-chat/api'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'

export interface SupportedLanguage {
  code: string
  name: string
  native_name: string
  formal_tone: boolean
}

export interface LanguageDetectionResult {
  detected_language: string
  confidence: number
  alternatives: Array<{
    language: string
    confidence: number
  }>
}

export interface TranslationResponse {
  original_content: string
  translated_content: string
  source_language: string
  target_language: string
  quality_score: number
  translation_time_ms: number
  cached: boolean
  confidence: number
}

interface UseLanguageReturn {
  // Current language state (from i18n system)
  currentLanguage: string
  supportedLanguages: SupportedLanguage[]
  isLoading: boolean
  error: string | null
  
  // Language management functions
  setLanguage: (language: string) => Promise<boolean>
  getUserLanguagePreference: () => Promise<string>
  getSupportedLanguages: () => Promise<SupportedLanguage[]>
  
  // Language detection
  detectLanguage: (content: string) => Promise<LanguageDetectionResult | null>
  
  // Translation functions
  translateContent: (
    content: string,
    targetLanguage: string,
    sourceLanguage?: string,
    contentType?: string
  ) => Promise<TranslationResponse | null>
  
  // Cache management
  clearTranslationCache: (language?: string) => Promise<boolean>
  
  // Utility functions
  getLanguageName: (code: string) => string
  isRTL: (language: string) => boolean
  formatDate: (date: Date, language?: string) => string
  formatNumber: (number: number, language?: string) => string
}

export function useLanguage(): UseLanguageReturn {
  // Use i18n system as single source of truth
  const i18n = useI18n()
  
  // Get auth context to check if user is authenticated
  const { session } = useAuth()
  
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize supported languages on mount
  useEffect(() => {
    getSupportedLanguages()
  }, [])

  // Sync with server preference on language change (only if authenticated)
  // DISABLED: Server sync is optional, local preference works fine
  // useEffect(() => {
  //   if (i18n.locale && session?.access_token) {
  //     syncLanguagePreference(i18n.locale)
  //   }
  // }, [i18n.locale, session?.access_token])

  const syncLanguagePreference = async (language: string) => {
    // DISABLED: Server sync causes HTTP 400 errors
    // Local preference in localStorage is sufficient
    return
    
    // Original code (disabled):
    // try {
    //   if (!session?.access_token) return
    //   await helpChatAPI.setUserLanguagePreference(language)
    // } catch (err) {
    //   if (process.env.NODE_ENV === 'development') {
    //     console.debug('Language preference not synced to server:', err)
    //   }
    // }
  }

  const setLanguage = useCallback(async (language: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Validate language is supported
      if (Array.isArray(supportedLanguages) && supportedLanguages.length > 0) {
        const isSupported = supportedLanguages.some(lang => lang.code === language)
        if (!isSupported) {
          throw new Error(`Unsupported language: ${language}`)
        }
      }

      // Update i18n system (single source of truth)
      await i18n.setLocale(language)

      // Sync with server (for help-chat API)
      await syncLanguagePreference(language)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set language'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supportedLanguages, i18n])

  const getUserLanguagePreference = useCallback(async (): Promise<string> => {
    try {
      const response = await helpChatAPI.getUserLanguagePreference()
      return response.language || 'en'
    } catch (err) {
      console.warn('Failed to get server language preference:', err)
      return i18n.locale // Fallback to i18n locale
    }
  }, [i18n.locale])

  const getSupportedLanguages = useCallback(async (): Promise<SupportedLanguage[]> => {
    try {
      setIsLoading(true)
      setError(null)

      const languages = await helpChatAPI.getSupportedLanguages()
      
      // If API returns empty array, use fallback languages
      if (!languages || languages.length === 0) {
        console.info('Using fallback languages (API returned empty)')
        const defaultLanguages: SupportedLanguage[] = [
          { code: 'en', name: 'English', native_name: 'English', formal_tone: false },
          { code: 'de', name: 'German', native_name: 'Deutsch', formal_tone: true },
          { code: 'fr', name: 'French', native_name: 'Français', formal_tone: true },
          { code: 'es', name: 'Spanish', native_name: 'Español', formal_tone: false },
          { code: 'pl', name: 'Polish', native_name: 'Polski', formal_tone: false },
          { code: 'gsw', name: 'Swiss German', native_name: 'Baseldytsch', formal_tone: false },
        ]
        setSupportedLanguages(defaultLanguages)
        return defaultLanguages
      }
      
      setSupportedLanguages(languages)
      return languages
    } catch (err) {
      // Silently fallback to default languages if API call fails
      console.warn('Help chat API error, using default languages:', err instanceof Error ? err.message : 'Unknown error')
      
      const defaultLanguages: SupportedLanguage[] = [
        { code: 'en', name: 'English', native_name: 'English', formal_tone: false },
        { code: 'de', name: 'German', native_name: 'Deutsch', formal_tone: true },
        { code: 'fr', name: 'French', native_name: 'Français', formal_tone: true },
        { code: 'es', name: 'Spanish', native_name: 'Español', formal_tone: false },
        { code: 'pl', name: 'Polish', native_name: 'Polski', formal_tone: false },
        { code: 'gsw', name: 'Swiss German', native_name: 'Baseldytsch', formal_tone: false },
      ]
      setSupportedLanguages(defaultLanguages)
      return defaultLanguages
    } finally {
      setIsLoading(false)
    }
  }, [])

  const detectLanguage = useCallback(async (content: string): Promise<LanguageDetectionResult | null> => {
    try {
      setError(null)

      if (!content || content.trim().length < 10) {
        throw new Error('Content must be at least 10 characters long for language detection')
      }

      const response = await helpChatAPI.detectLanguage(content)
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Language detection failed'
      setError(errorMessage)
      return null
    }
  }, [])

  const translateContent = useCallback(async (
    content: string,
    targetLanguage: string,
    sourceLanguage: string = 'en',
    contentType: string = 'general'
  ): Promise<TranslationResponse | null> => {
    try {
      setError(null)

      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty')
      }

      const response = await helpChatAPI.translateContent(content, targetLanguage, sourceLanguage, contentType)
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed'
      setError(errorMessage)
      return null
    }
  }, [])

  const clearTranslationCache = useCallback(async (language?: string): Promise<boolean> => {
    try {
      setError(null)
      await helpChatAPI.clearTranslationCache(language)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear translation cache'
      setError(errorMessage)
      return false
    }
  }, [])

  const getLanguageName = useCallback((code: string): string => {
    if (!Array.isArray(supportedLanguages) || supportedLanguages.length === 0) {
      return code
    }
    const language = supportedLanguages.find(lang => lang.code === code)
    return language?.native_name || language?.name || code
  }, [supportedLanguages])

  const isRTL = useCallback((language: string): boolean => {
    // Add RTL languages as needed
    const rtlLanguages = ['ar', 'he', 'fa', 'ur']
    return rtlLanguages.includes(language)
  }, [])

  const formatDate = useCallback((date: Date, language?: string): string => {
    const locale = language || i18n.locale
    
    try {
      // Map language codes to locale strings
      const localeMap: Record<string, string> = {
        'en': 'en-US',
        'de': 'de-DE',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'pl': 'pl-PL',
        'gsw': 'de-CH',
      }

      const localeString = localeMap[locale] || locale
      return date.toLocaleDateString(localeString, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch (err) {
      // Fallback to default formatting
      return date.toLocaleDateString()
    }
  }, [i18n.locale])

  const formatNumber = useCallback((number: number, language?: string): string => {
    const locale = language || i18n.locale
    
    try {
      // Map language codes to locale strings
      const localeMap: Record<string, string> = {
        'en': 'en-US',
        'de': 'de-DE',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'pl': 'pl-PL',
        'gsw': 'de-CH',
      }

      const localeString = localeMap[locale] || locale
      return number.toLocaleString(localeString)
    } catch (err) {
      // Fallback to default formatting
      return number.toLocaleString()
    }
  }, [i18n.locale])

  return {
    // State (from i18n system)
    currentLanguage: i18n.locale,
    supportedLanguages,
    isLoading: isLoading || i18n.isLoading,
    error,
    
    // Language management
    setLanguage,
    getUserLanguagePreference,
    getSupportedLanguages,
    
    // Language detection
    detectLanguage,
    
    // Translation
    translateContent,
    
    // Cache management
    clearTranslationCache,
    
    // Utilities
    getLanguageName,
    isRTL,
    formatDate,
    formatNumber,
  }
}

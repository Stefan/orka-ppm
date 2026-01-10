/**
 * Language management hook for multi-language support
 * Handles language preferences, detection, and translation
 */

import { useState, useEffect, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { helpChatAPI } from '../lib/help-chat/api'

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
  // Current language state
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

const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8000'

export function useLanguage(): UseLanguageReturn {
  const [currentLanguage, setCurrentLanguage] = useLocalStorage<string>('help-chat-language', 'en')
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize supported languages on mount
  useEffect(() => {
    getSupportedLanguages()
  }, [])

  // Sync with server preference on language change
  useEffect(() => {
    if (currentLanguage) {
      syncLanguagePreference(currentLanguage)
    }
  }, [currentLanguage])

  const syncLanguagePreference = async (language: string) => {
    try {
      await helpChatAPI.setUserLanguagePreference(language)
    } catch (err) {
      console.warn('Failed to sync language preference to server:', err)
      // Don't throw error - local preference still works
    }
  }

  const setLanguage = useCallback(async (language: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Validate language is supported
      if (supportedLanguages.length > 0) {
        const isSupported = supportedLanguages.some(lang => lang.code === language)
        if (!isSupported) {
          throw new Error(`Unsupported language: ${language}`)
        }
      }

      // Update local storage
      setCurrentLanguage(language)

      // Sync with server
      await syncLanguagePreference(language)

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set language'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supportedLanguages, setCurrentLanguage])

  const getUserLanguagePreference = useCallback(async (): Promise<string> => {
    try {
      const response = await helpChatAPI.getUserLanguagePreference()
      return response.language || 'en'
    } catch (err) {
      console.warn('Failed to get server language preference:', err)
      return currentLanguage // Fallback to local preference
    }
  }, [currentLanguage])

  const getSupportedLanguages = useCallback(async (): Promise<SupportedLanguage[]> => {
    try {
      setIsLoading(true)
      setError(null)

      const languages = await helpChatAPI.getSupportedLanguages()
      setSupportedLanguages(languages)
      return languages
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get supported languages'
      setError(errorMessage)
      
      // Fallback to default languages
      const defaultLanguages: SupportedLanguage[] = [
        { code: 'en', name: 'English', native_name: 'English', formal_tone: false },
        { code: 'de', name: 'German', native_name: 'Deutsch', formal_tone: true },
        { code: 'fr', name: 'French', native_name: 'Français', formal_tone: true },
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
    const language = supportedLanguages.find(lang => lang.code === code)
    return language?.native_name || language?.name || code
  }, [supportedLanguages])

  const isRTL = useCallback((language: string): boolean => {
    // Add RTL languages as needed
    const rtlLanguages = ['ar', 'he', 'fa', 'ur']
    return rtlLanguages.includes(language)
  }, [])

  const formatDate = useCallback((date: Date, language?: string): string => {
    const locale = language || currentLanguage
    
    try {
      // Map language codes to locale strings
      const localeMap: Record<string, string> = {
        'en': 'en-US',
        'de': 'de-DE',
        'fr': 'fr-FR',
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
  }, [currentLanguage])

  const formatNumber = useCallback((number: number, language?: string): string => {
    const locale = language || currentLanguage
    
    try {
      // Map language codes to locale strings
      const localeMap: Record<string, string> = {
        'en': 'en-US',
        'de': 'de-DE',
        'fr': 'fr-FR',
      }

      const localeString = localeMap[locale] || locale
      return number.toLocaleString(localeString)
    } catch (err) {
      // Fallback to default formatting
      return number.toLocaleString()
    }
  }, [currentLanguage])

  return {
    // State
    currentLanguage,
    supportedLanguages,
    isLoading,
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
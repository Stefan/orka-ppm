/**
 * Language Selector Component
 * Allows users to select their preferred language for help chat
 */

'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDownIcon, GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useLanguage, type SupportedLanguage } from '../../hooks/useLanguage'
import { useHelpChat } from '../../app/providers/HelpChatProvider'

interface LanguageSelectorProps {
  className?: string
  showLabel?: boolean
  compact?: boolean
}

export function LanguageSelector({ 
  className = '', 
  showLabel = true, 
  compact = false 
}: LanguageSelectorProps) {
  const { 
    currentLanguage, 
    supportedLanguages, 
    setLanguage, 
    isLoading, 
    error,
    getLanguageName 
  } = useLanguage()
  
  const { updatePreferences } = useHelpChat()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isChanging, setIsChanging] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-language-selector]')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
    
    // Return cleanup function for when condition is not met
    return () => {}
  }, [isOpen])

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage || isChanging) return

    setIsChanging(true)
    setIsOpen(false)

    try {
      // Update language preference
      const success = await setLanguage(languageCode)
      
      if (success) {
        // Update help chat preferences
        await updatePreferences({ language: languageCode as 'en' | 'de' | 'fr' })
      }
    } catch (err) {
      console.error('Failed to change language:', err)
    } finally {
      setIsChanging(false)
    }
  }

  const currentLanguageData = supportedLanguages.find(lang => lang.code === currentLanguage)
  const displayName = currentLanguageData?.native_name || getLanguageName(currentLanguage)

  if (compact) {
    return (
      <div className={`relative ${className}`} data-language-selector>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || isChanging}
          className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title={`Current language: ${displayName}`}
        >
          <GlobeAltIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{currentLanguage.toUpperCase()}</span>
          <ChevronDownIcon className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-1">
              {supportedLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  disabled={isChanging}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 ${
                    language.code === currentLanguage 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{language.native_name}</div>
                      <div className="text-xs text-gray-500">{language.name}</div>
                    </div>
                    {language.code === currentLanguage && (
                      <CheckIcon className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} data-language-selector>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Language
        </label>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || isChanging}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-2">
          <GlobeAltIcon className="h-4 w-4 text-gray-400" />
          <span>{displayName}</span>
          {isChanging && (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          )}
        </div>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1 max-h-60 overflow-y-auto">
            {supportedLanguages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                disabled={isChanging}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 ${
                  language.code === currentLanguage 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{language.native_name}</div>
                    <div className="text-xs text-gray-500">{language.name}</div>
                  </div>
                  {language.code === currentLanguage && (
                    <CheckIcon className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default LanguageSelector
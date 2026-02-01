'use client'

import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'gsw', label: 'Baseldytsch', flag: '🇨🇭' }
]

interface GlobalLanguageSelectorProps {
  variant?: 'sidebar' | 'topbar' | 'dropdown'
}

/**
 * Sync language to cookies for Server Components
 */
function syncLanguageToCookie(language: string) {
  document.cookie = `orka-ppm-locale=${language}; path=/; max-age=31536000; SameSite=Lax`
}

export function GlobalLanguageSelector({ variant = 'sidebar' }: GlobalLanguageSelectorProps) {
  const { locale, setLocale, isLoading } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [switchingLanguage, setSwitchingLanguage] = useState(false)

  const selectedLanguage = LANGUAGES.find(lang => lang.code === locale) || LANGUAGES[0]
  
  const handleLanguageChange = async (languageCode: string) => {
    console.log('🌐 [GlobalLanguageSelector] handleLanguageChange called:', {
      newLanguage: languageCode,
      currentLocale: locale,
      isSame: languageCode === locale
    })
    
    if (languageCode === locale) {
      setIsOpen(false)
      return
    }

    setSwitchingLanguage(true)
    
    try {
      // Sync to cookie for Server Components
      syncLanguageToCookie(languageCode)
      console.log('🌐 [GlobalLanguageSelector] Cookie synced for:', languageCode)
      
      // Set language through the i18n system
      await setLocale(languageCode)
      console.log('🌐 [GlobalLanguageSelector] setLocale completed for:', languageCode)
      
      setIsOpen(false)
      
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to change language:', error)
    } finally {
      setSwitchingLanguage(false)
    }
  }

  const isLoadingState = isLoading || switchingLanguage

  // Topbar variant - compact button with dropdown
  if (variant === 'topbar') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Change Language"
          disabled={isLoadingState}
        >
          {isLoadingState ? (
            <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
          ) : (
            <Globe className="h-4 w-4 text-gray-600" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {selectedLanguage.code.toUpperCase()}
          </span>
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoadingState}
                className={`
                  flex items-center w-full px-3 py-2 mx-2 rounded-lg text-sm text-left transition-all duration-200
                  ${locale === lang.code
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-900'
                  }
                  ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                style={{
                  backgroundColor: locale === lang.code ? undefined : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (locale !== lang.code) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (locale !== lang.code) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span className="mr-2">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Dropdown variant - for mobile user menu
  if (variant === 'dropdown') {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500 px-2 mb-1 flex items-center">
          Language
          {isLoadingState && <Loader2 className="h-3 w-3 ml-2 animate-spin" />}
        </div>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isLoadingState}
            className={`
              flex items-center w-full px-2 py-1.5 text-sm text-left transition-all duration-200 rounded
              ${locale === lang.code
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-900'
              }
              ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={{
              backgroundColor: locale === lang.code ? undefined : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (locale !== lang.code) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (locale !== lang.code) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // Sidebar variant - original design
  return (
    <div className="relative group">
      <button
        className="flex items-center w-full py-2 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        title="Change Language"
        disabled={isLoadingState}
      >
        {isLoadingState ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Globe className="mr-2 h-4 w-4" />
        )}
        <span className="text-sm">{selectedLanguage.flag} {selectedLanguage.label}</span>
      </button>
      
      <div className="absolute bottom-full left-0 mb-2 w-full bg-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isLoadingState}
            className={`
              flex items-center w-full px-4 py-2 text-sm text-left transition-all duration-200 first:rounded-t-lg last:rounded-b-lg
              ${locale === lang.code
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-300 hover:bg-blue-600 hover:text-white hover:shadow-md'
              }
              ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

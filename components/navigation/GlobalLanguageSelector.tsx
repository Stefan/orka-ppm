'use client'

import { useState, useMemo, useRef } from 'react'
import { Globe, Loader2, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types'

const LANGUAGES = SUPPORTED_LANGUAGES.map((lang) => ({
  code: lang.code,
  label: lang.nativeName,
  flag: lang.flag ?? '🌐',
}))

function filterLanguages(query: string) {
  if (!query.trim()) return LANGUAGES
  const q = query.trim().toLowerCase()
  return LANGUAGES.filter(
    (lang) =>
      lang.label.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
  )
}

/** Font stack for the script of the selected language (native display) */
function fontFamilyForLocale(locale: string): string | undefined {
  if (locale.startsWith('zh')) return '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", sans-serif'
  if (locale.startsWith('ja')) return '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif'
  if (locale.startsWith('ko')) return '"Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
  if (locale === 'hi-IN') return '"Noto Sans Devanagari", "Mangal", "Nirmala UI", sans-serif'
  return undefined // Latin etc. use document default
}

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
  const [searchQuery, setSearchQuery] = useState('')

  const selectedLanguage = LANGUAGES.find(lang => lang.code === locale) || LANGUAGES[0]
  const filteredLanguages = useMemo(() => filterLanguages(searchQuery), [searchQuery])
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const handleLanguageChange = async (languageCode: string) => {
    console.log('🌐 [GlobalLanguageSelector] handleLanguageChange called:', {
      newLanguage: languageCode,
      currentLocale: locale,
      isSame: languageCode === locale
    })
    
    if (languageCode === locale) {
      setIsOpen(false)
      setSearchQuery('')
      return
    }

    setSwitchingLanguage(true)
    setSearchQuery('')
    
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
          onBlur={() => {
            setTimeout(() => {
              if (dropdownRef.current?.contains(document.activeElement)) return
              setIsOpen(false)
            }, 200)
          }}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title="Change Language"
          disabled={isLoadingState}
        >
          {isLoadingState ? (
            <Loader2 className="h-4 w-4 text-gray-600 dark:text-slate-300 animate-spin" />
          ) : (
            <Globe className="h-4 w-4 text-gray-700 dark:text-slate-300" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-slate-200" style={fontFamilyForLocale(locale) ? { fontFamily: fontFamilyForLocale(locale) } : undefined}>
            {fontFamilyForLocale(locale) ? selectedLanguage.label : selectedLanguage.code.toUpperCase()}
          </span>
        </button>
        
        {isOpen && (
          <div ref={dropdownRef} className="absolute right-0 mt-2 w-56 min-w-0 overflow-hidden rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 z-50">
            <div className="px-2 pb-2 border-b border-gray-100 dark:border-slate-600">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search language..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto px-2 pt-2">
              {filteredLanguages.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">No language found</p>
              ) : (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    disabled={isLoadingState}
                    className={`
                      flex items-center w-full min-w-0 px-3 py-2 rounded-lg text-sm text-left transition-colors
                      ${locale === lang.code
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-gray-700 dark:text-slate-200 hover:bg-blue-100/70 dark:hover:bg-slate-600/70'
                      }
                      ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span className="mr-2 shrink-0">{lang.flag}</span>
                    <span className="truncate" style={fontFamilyForLocale(lang.code) ? { fontFamily: fontFamilyForLocale(lang.code) } : undefined}>{lang.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Dropdown variant - for mobile user menu
  if (variant === 'dropdown') {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-500 dark:text-slate-400 px-2 mb-1 flex items-center">
          Language
          {isLoadingState && <Loader2 className="h-3 w-3 ml-2 animate-spin" />}
        </div>
        <div className="relative px-2 pb-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-40 overflow-y-auto">
          {filteredLanguages.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400">No language found</p>
          ) : (
            filteredLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoadingState}
                className={`
                  flex items-center w-full min-w-0 px-2 py-1.5 text-sm text-left transition-colors rounded
                  ${locale === lang.code
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-blue-100/70 dark:hover:bg-slate-600/70'
                  }
                  ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="mr-2 shrink-0">{lang.flag}</span>
                <span className="truncate" style={fontFamilyForLocale(lang.code) ? { fontFamily: fontFamilyForLocale(lang.code) } : undefined}>{lang.label}</span>
              </button>
            ))
          )}
        </div>
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
        <span className="text-sm" style={fontFamilyForLocale(locale) ? { fontFamily: fontFamilyForLocale(locale) } : undefined}>{selectedLanguage.flag} {selectedLanguage.label}</span>
      </button>
      
      <div className="absolute bottom-full left-0 mb-2 w-full bg-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
        <div className="p-2 border-b border-gray-600">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search language..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded bg-gray-600 text-gray-100 placeholder-gray-400 border-0 focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          {filteredLanguages.length === 0 ? (
            <p className="px-4 py-2 text-sm text-gray-400">No language found</p>
          ) : (
            filteredLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoadingState}
                className={`
                  flex items-center w-full px-4 py-2 text-sm text-left transition-all duration-200
                  ${locale === lang.code
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-300 hover:bg-blue-600 hover:text-white hover:shadow-md'
                  }
                  ${isLoadingState ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="mr-2">{lang.flag}</span>
                <span style={fontFamilyForLocale(lang.code) ? { fontFamily: fontFamilyForLocale(lang.code) } : undefined}>{lang.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

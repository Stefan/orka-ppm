/**
 * I18n Context Module
 * 
 * This module provides React Context for managing internationalization state
 * across the application. It includes:
 * - I18nProvider component for wrapping the app
 * - useI18n hook for accessing i18n state and functions
 * - useTranslations convenience hook for just the translation function
 * 
 * Features:
 * - Automatic language detection from localStorage and browser
 * - Language persistence to localStorage
 * - Lazy loading of translation files
 * - Translation function with dot-notation key lookup
 * - Interpolation support for dynamic values
 * - Fallback to English for missing translations
 * - Development mode warnings for missing keys
 */

'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { loadTranslations, isLanguageCached, getCachedTranslations } from './loader';
import { 
  TranslationDictionary, 
  TranslationKey, 
  SupportedLocale,
  InterpolationParams,
  DEFAULT_LOCALE,
  STORAGE_KEY,
  COOKIE_NAME,
  SUPPORTED_LANGUAGES
} from './types';
import { isPluralRules, formatPlural } from './pluralization';
import { getLocaleFormat, type LocaleFormatConfig } from './locale-config';

/**
 * I18n Context value interface
 * Defines the shape of the context value provided to consumers
 */
interface I18nContextValue {
  /** Current locale code (e.g., 'en', 'de') */
  locale: string;
  /** Current translation dictionary */
  translations: TranslationDictionary;
  /** Loading state - true while fetching translations */
  isLoading: boolean;
  /** Function to change the current locale */
  setLocale: (locale: string) => Promise<void>;
  /** Translation function - converts keys to translated strings */
  t: (key: TranslationKey, params?: InterpolationParams) => string;
  /** Date locale, default currency, and time zone for the current language */
  localeFormat: LocaleFormatConfig;
}

/**
 * I18n Context
 * Provides i18n state and functions throughout the component tree
 */
const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * List of supported locale codes
 */
const SUPPORTED_LOCALES = SUPPORTED_LANGUAGES.map(lang => lang.code);

/**
 * Detect browser language and map to supported locale
 * 
 * @returns Supported locale code or default locale
 * 
 * @example
 * // Browser language is 'en-US'
 * detectBrowserLanguage(); // Returns 'en'
 * 
 * // Browser language is 'de-AT'
 * detectBrowserLanguage(); // Returns 'de'
 * 
 * // Browser language is 'ja' (not supported)
 * detectBrowserLanguage(); // Returns 'en' (default)
 */
function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  
  // Get browser language and extract base code (e.g., 'en-US' -> 'en')
  const browserLang = navigator.language.split('-')[0];
  console.log('🌍 [i18n] Browser language detected:', navigator.language, '-> base:', browserLang);
  
  // Check if the base language code is supported
  const detectedLocale = SUPPORTED_LOCALES.includes(browserLang as SupportedLocale) 
    ? browserLang 
    : DEFAULT_LOCALE;
  
  console.log('🌍 [i18n] Using locale:', detectedLocale);
  return detectedLocale;
}

/**
 * Get saved locale from localStorage
 * 
 * @returns Saved locale code or null if not found
 */
function getSavedLocale(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    
    // Validate that the saved locale is supported
    if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
      console.log('🌍 [i18n] Found saved locale in localStorage:', saved);
      return saved;
    }
    
    console.log('🌍 [i18n] No valid saved locale in localStorage');
    return null;
  } catch (error) {
    console.warn('Failed to read locale from localStorage:', error);
    return null;
  }
}

/**
 * Save locale to localStorage and cookies
 * 
 * @param locale - Locale code to save
 */
function saveLocale(locale: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    console.log('🌍 [i18n] Saving locale to localStorage and cookies:', locale);
    
    // Save to localStorage for client-side persistence
    localStorage.setItem(STORAGE_KEY, locale);
    
    // Save to cookie for server-side access
    // Set cookie with 1 year expiration
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    document.cookie = `${COOKIE_NAME}=${locale}; path=/; expires=${expirationDate.toUTCString()}; SameSite=Lax`;
    
    console.log('🌍 [i18n] Locale saved successfully');
  } catch (error) {
    console.warn('Failed to save locale to localStorage/cookies:', error);
  }
}

/**
 * I18nProvider Component
 * 
 * Wraps the application to provide i18n context to all child components.
 * Handles language detection, loading, and state management.
 * 
 * @param children - Child components to wrap
 * 
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <I18nProvider>
 *           {children}
 *         </I18nProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  // Initialize locale: prioritize saved preference, then browser language
  const [locale, setLocaleState] = useState<string>(() => {
    // First check if user has explicitly saved a preference
    const saved = getSavedLocale();
    if (saved) {
      console.log('🌍 [i18n] Using saved locale:', saved);
      return saved;
    }
    
    // If no saved preference, detect from browser and save it
    const browserLang = detectBrowserLanguage();
    console.log('🌍 [i18n] No saved locale, using browser language:', browserLang);
    
    // Save the browser-detected language so it persists
    saveLocale(browserLang);
    
    return browserLang;
  });
  
  // Initialize translations from cache if available
  const [translations, setTranslations] = useState<TranslationDictionary>(() => {
    // Try to get cached translations immediately
    const cached = getCachedTranslations(locale);
    return cached || {};
  });
  
  // Only show loading if translations are not yet loaded
  const [isLoading, setIsLoading] = useState(() => {
    // Check if translations are already cached
    return !isLanguageCached(locale);
  });

  // Load translations when locale changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      console.log('🌍 [i18n] Loading translations for locale:', locale)
      
      // Only set loading if not already cached
      const isCached = isLanguageCached(locale);
      console.log('🌍 [i18n] Is locale cached?', isCached)
      
      if (!isCached) {
        setIsLoading(true);
      }
      
      try {
        const newTranslations = await loadTranslations(locale);
        console.log('🌍 [i18n] Translations loaded successfully for:', locale, 'keys:', Object.keys(newTranslations).slice(0, 5))
        
        if (!cancelled) {
          setTranslations(newTranslations);
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
        
        // If loading failed and we're not already on English, try English
        if (!cancelled && locale !== DEFAULT_LOCALE) {
          try {
            const fallbackTranslations = await loadTranslations(DEFAULT_LOCALE);
            setTranslations(fallbackTranslations);
          } catch (fallbackError) {
            console.error('Failed to load fallback translations:', fallbackError);
            // Set empty translations as last resort
            setTranslations({});
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          console.log('🌍 [i18n] Translation loading complete for:', locale)
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  /**
   * Set the current locale
   * 
   * @param newLocale - Locale code to switch to
   * 
   * @example
   * ```tsx
   * const { setLocale } = useI18n();
   * 
   * // Switch to German
   * await setLocale('de');
   * ```
   */
  const setLocale = useCallback(async (newLocale: string) => {
    console.log('🌍 [i18n] setLocale called with:', newLocale, 'current locale:', locale)
    
    // Validate locale is supported
    if (!SUPPORTED_LOCALES.includes(newLocale as SupportedLocale)) {
      console.warn(`Unsupported locale: ${newLocale}. Supported locales: ${SUPPORTED_LOCALES.join(', ')}`);
      return;
    }

    // Save to localStorage
    saveLocale(newLocale);

    // If already cached, update immediately
    if (isLanguageCached(newLocale)) {
      console.log('🌍 [i18n] Locale cached, updating immediately to:', newLocale)
      setLocaleState(newLocale);
    } else {
      // Show loading state while fetching
      console.log('🌍 [i18n] Locale not cached, loading translations for:', newLocale)
      setIsLoading(true);
      setLocaleState(newLocale);
    }
  }, [locale]);

  /**
   * Translation function
   * 
   * Looks up a translation key in the current language's translations.
   * Supports dot-notation for nested keys, interpolation for dynamic values,
   * and pluralization for count-based translations.
   * 
   * @param key - Translation key in dot notation (e.g., 'nav.dashboards')
   * @param params - Optional parameters for interpolation and pluralization
   * @returns Translated string
   * 
   * @example
   * ```tsx
   * const { t } = useI18n();
   * 
   * // Simple translation
   * t('nav.dashboards'); // "Dashboards"
   * 
   * // With interpolation
   * t('validation.minLength', { min: 5 }); // "Minimum length is 5 characters"
   * 
   * // With pluralization
   * t('items.count', { count: 1 }); // "1 item"
   * t('items.count', { count: 5 }); // "5 items"
   * ```
   */
  const t = useCallback((
    key: TranslationKey,
    params?: InterpolationParams
  ): string => {
    // #region agent log (only when NEXT_PUBLIC_AGENT_INGEST_URL is set)
    const ingestUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_AGENT_INGEST_URL : undefined;
    const isPmrSections = typeof key === 'string' && key.startsWith('pmr.sections');
    const isPmrPlaceholder = typeof key === 'string' && key.startsWith('pmr.placeholderContent');
    if (ingestUrl && isPmrSections) {
      fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(entry)',message:'t() pmr.sections entry',data:{key,isLoading,locale,translationsKeysCount:Object.keys(translations).length,hasPmr:!!(translations as any).pmr,hasSections:!!(translations as any).pmr?.sections},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    }
    if (ingestUrl && isPmrPlaceholder) {
      const tAny = translations as Record<string, unknown>;
      const pc = tAny?.pmr as Record<string, unknown> | undefined;
      const placeholderContent = pc?.placeholderContent as Record<string, string> | undefined;
      fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(entry)',message:'t() pmr.placeholderContent entry',data:{key,isLoading,locale,translationsKeysCount:Object.keys(translations).length,hasPmr:!!tAny?.pmr,hasPlaceholderContent:!!placeholderContent,reportTitle:placeholderContent?.reportTitle},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    }
    // #endregion
    // During loading, return the key without logging warnings
    // This prevents console spam during initial page load
    if (isLoading || Object.keys(translations).length === 0) {
      return key;
    }
    
    // Navigate nested object using dot notation
    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // #region agent log
        if (ingestUrl && isPmrSections) {
          fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(notFound)',message:'t() key not found',data:{key,locale,result:'KEY_NOT_FOUND'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
        }
        if (ingestUrl && isPmrPlaceholder) {
          fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(notFound)',message:'t() placeholderContent key not found',data:{key,locale,result:'KEY_NOT_FOUND'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
        }
        if (typeof key === 'string' && key.includes('noSlowQueries')) {
          const tAny = translations as Record<string, unknown>;
          const adminPerf = tAny?.adminPerformance as Record<string, unknown> | undefined;
          fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:noSlowQueriesNotFound',message:'adminPerformance.noSlowQueries key not found',data:{key,locale,hasAdminPerformance:!!adminPerf,adminPerfKeys:adminPerf?Object.keys(adminPerf):[],topLevelKeys:Object.keys(translations).slice(0,12)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        }
        // #endregion
        // Key not found - log warning in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Translation key not found: ${key} (locale: ${locale})`);
        }
        
        // Return the key itself as fallback
        return key;
      }
    }

    // #region agent log
    if (ingestUrl && isPmrSections && typeof value === 'string') {
      fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(found)',message:'t() pmr.sections found',data:{key,locale,result:value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    }
    if (ingestUrl && isPmrPlaceholder && typeof value === 'string') {
      fetch(ingestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/context.tsx:t(found)',message:'t() placeholderContent found',data:{key,locale,result:value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    }
    // #endregion
    // Ensure we got a string
    if (typeof value !== 'string') {
      // Check if value is a plural rules object
      if (isPluralRules(value)) {
        // Handle pluralization
        const count = params?.count;
        
        if (typeof count !== 'number') {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Plural translation requires 'count' parameter: ${key}`);
          }
          // Fall back to 'other' form if count is missing
          value = value.other;
        } else {
          // Select the appropriate plural form and format with count
          const formatted = formatPlural(value, count, locale as SupportedLocale);
          
          // Handle any additional interpolation parameters (besides count)
          if (params && Object.keys(params).length > 1) {
            return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
              // Skip 'count' as it's already handled by formatPlural
              if (paramKey === 'count') return str;
              
              // Escape HTML in parameter values to prevent XSS
              const escapedValue = String(paramValue)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
              
              // Escape special regex characters in the parameter key
              const escapedKey = paramKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              // Escape $ in replacement value ($ has special meaning in String.replace)
              const safeReplacementValue = escapedValue.replace(/\$/g, '$$$$');
              
              // Replace all occurrences of {paramKey} with the escaped value
              return str.replace(
                new RegExp(`\\{${escapedKey}\\}`, 'g'), 
                safeReplacementValue
              );
            }, formatted);
          }
          
          return formatted;
        }
      } else {
        // Not a string and not plural rules
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Translation value is not a string: ${key} (got ${typeof value})`);
        }
        return key;
      }
    }

    // Handle interpolation
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        // Escape HTML in parameter values to prevent XSS
        const escapedValue = String(paramValue)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
        
        // Escape special regex characters in the parameter key
        const escapedKey = paramKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Escape $ in replacement value ($ has special meaning in String.replace)
        const safeReplacementValue = escapedValue.replace(/\$/g, '$$$$');
        
        // Replace all occurrences of {paramKey} with the escaped value
        return str.replace(
          new RegExp(`\\{${escapedKey}\\}`, 'g'), 
          safeReplacementValue
        );
      }, value);
    }

    return value;
  }, [translations, locale, isLoading]);

  const contextValue: I18nContextValue = {
    locale,
    translations,
    isLoading,
    setLocale,
    t,
    localeFormat: getLocaleFormat(locale),
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook for accessing i18n in client components
 * 
 * Provides access to the full i18n context including locale, translations,
 * loading state, and functions for changing locale and translating keys.
 * 
 * @returns I18n context value
 * @throws Error if used outside I18nProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { locale, t, setLocale, isLoading } = useI18n();
 *   
 *   return (
 *     <div>
 *       <p>Current language: {locale}</p>
 *       <p>{t('nav.dashboards')}</p>
 *       <button onClick={() => setLocale('de')}>
 *         Switch to German
 *       </button>
 *       {isLoading && <p>Loading...</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  
  return context;
}

/**
 * Convenience hook that returns just the translation function and metadata
 * 
 * Simpler alternative to useI18n when you only need the translation function.
 * 
 * @returns Object with translation function, locale, and loading state (no namespace)
 *          or a scoped translation function when namespace is provided
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, locale, isLoading } = useTranslations();
 *   
 *   return (
 *     <div>
 *       <h1>{t('dashboard.title')}</h1>
 *       <p>{t('dashboard.projects')}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranslations(): {
  t: (key: TranslationKey, params?: InterpolationParams) => string;
  locale: string;
  isLoading: boolean;
};
export function useTranslations(namespace: string): (
  key: string,
  params?: Record<string, unknown>
) => string;
export function useTranslations(namespace?: string) {
  const { t: baseT, locale, isLoading } = useI18n();
  
  // If namespace is provided, return a scoped translation function
  if (namespace) {
    const scopedT = (key: string, params?: Record<string, unknown>) => {
      return baseT(`${namespace}.${key}` as TranslationKey, params);
    };
    return scopedT;
  }
  
  // Otherwise, return the full context
  return { t: baseT, locale, isLoading };
}

/**
 * Translation Loader Module
 * 
 * This module is responsible for fetching and caching translation files.
 * It provides functions for:
 * - Loading translations with automatic caching
 * - Preloading translations in the background
 * - Managing the translation cache
 * - Checking cache status
 * 
 * Features:
 * - In-memory caching to prevent redundant network requests
 * - Automatic retry logic on failure
 * - Fallback to English when a language fails to load
 * - Error handling with detailed logging
 */

import { TranslationDictionary, SupportedLocale, DEFAULT_LOCALE } from './types';

/**
 * Translation cache - in-memory storage
 * Maps locale codes to their translation dictionaries
 */
const translationCache = new Map<string, TranslationDictionary>();

// Expose cache globally for synchronous access
if (typeof window !== 'undefined') {
  (window as any).__translationCache = translationCache;
}

/**
 * In-flight requests - tracks ongoing fetch operations
 * Prevents duplicate requests for the same locale
 */
const inFlightRequests = new Map<string, Promise<TranslationDictionary>>();

/**
 * Load translations for a specific language
 * Returns cached version if available, otherwise fetches from server
 * 
 * @param locale - The language code to load (e.g., 'en', 'de', 'fr')
 * @returns Promise resolving to the translation dictionary
 * 
 * @example
 * ```typescript
 * const translations = await loadTranslations('de');
 * console.log(translations.common.save); // "Speichern"
 * ```
 * 
 * Error handling:
 * 1. Check cache first
 * 2. If not cached, fetch from /locales/{locale}.json
 * 3. If fetch fails, retry once
 * 4. If retry fails and locale is not English, fall back to English
 * 5. If all fails, return empty object
 */
export async function loadTranslations(
  locale: string
): Promise<TranslationDictionary> {
  // In development, bypass cache so updated locale files (e.g. new keys) are always loaded
  const useCache = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  if (useCache && translationCache.has(locale)) {
    const cached = translationCache.get(locale)!;
    // #region agent log
    const pmr = (cached as Record<string, unknown>)?.pmr as Record<string, unknown> | undefined;
    const sections = pmr?.sections as Record<string, string> | undefined;
    const placeholderContent = pmr?.placeholderContent as Record<string, string> | undefined;
    const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);
    if (!isTest && typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/loader.ts:cacheHit',message:'loader cache hit',data:{locale,hasPmrSections:!!sections,hasPlaceholderContent:!!placeholderContent,reportTitle:placeholderContent?.reportTitle},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{}); }
    // #endregion
    return cached;
  }

  // Check if there's already a request in flight for this locale
  if (inFlightRequests.has(locale)) {
    return inFlightRequests.get(locale)!;
  }

  // Create the fetch promise
  const fetchPromise = (async () => {
    try {
      // Fetch from public folder (no-store so updated locale files are always loaded)
      const response = await fetch(`/locales/${locale}.json`, { cache: 'no-store' });
      
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${locale}: HTTP ${response.status}`);
      }

      const translations = await response.json();
      // #region agent log
      const pmr = (translations as Record<string, unknown>)?.pmr as Record<string, unknown> | undefined;
      const sections = pmr?.sections as Record<string, string> | undefined;
      const placeholderContent = pmr?.placeholderContent as Record<string, string> | undefined;
      const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);
      if (!isTest && typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/i18n/loader.ts:afterParse',message:'loader after fetch',data:{locale,hasPmrSections:!!sections,hasPlaceholderContent:!!placeholderContent,reportTitle:placeholderContent?.reportTitle},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{}); }
      // #endregion
      // Validate structure
      if (typeof translations !== 'object' || translations === null || Array.isArray(translations)) {
        throw new Error(`Invalid translation file format for ${locale}: expected object, got ${Array.isArray(translations) ? 'array' : typeof translations}`);
      }

      // Always update cache on successful load so isLanguageCached/getCachedTranslations reflect loaded data
      translationCache.set(locale, translations);
      return translations;
    } catch (error) {
      console.error(`Error loading translations for ${locale}:`, error);
      
      // Retry once
      try {
        const response = await fetch(`/locales/${locale}.json`, { cache: 'no-store' });
        
        if (!response.ok) {
          throw new Error(`Retry failed: HTTP ${response.status}`);
        }
        
        const translations = await response.json();
        
        // Validate structure on retry
        if (typeof translations !== 'object' || translations === null || Array.isArray(translations)) {
          throw new Error(`Invalid translation file format on retry for ${locale}`);
        }
        translationCache.set(locale, translations);
        return translations;
      } catch (retryError) {
        console.error(`Retry failed for ${locale}:`, retryError);
        
        // If not English, try English fallback
        if (locale !== DEFAULT_LOCALE) {
          console.warn(`Falling back to ${DEFAULT_LOCALE} for ${locale}`);
          return loadTranslations(DEFAULT_LOCALE);
        }
        
        // Return empty object as last resort
        console.error('All translation loading failed, returning empty translations');
        return {};
      }
    } finally {
      // Clean up in-flight request
      inFlightRequests.delete(locale);
    }
  })();

  // Store the in-flight request
  inFlightRequests.set(locale, fetchPromise);

  return fetchPromise;
}

/**
 * Preload translations for a language without waiting
 * Useful for loading translations in the background before they're needed
 * 
 * @param locale - The language code to preload
 * 
 * @example
 * ```typescript
 * // Preload German translations in the background
 * preloadTranslations('de');
 * 
 * // Later, when user switches to German, it's already cached
 * const translations = await loadTranslations('de'); // Instant!
 * ```
 * 
 * This function does not throw errors - failures are logged but don't affect execution
 */
export function preloadTranslations(locale: string): void {
  // Only preload if not already cached
  if (!translationCache.has(locale)) {
    loadTranslations(locale).catch(error => {
      console.warn(`Failed to preload ${locale}:`, error);
    });
  }
}

/**
 * Clear cache for a specific language or all languages
 * Useful for development, testing, or forcing a reload of translations
 * 
 * @param locale - Optional language code to clear. If omitted, clears all cached translations
 * 
 * @example
 * ```typescript
 * // Clear only German translations
 * clearTranslationCache('de');
 * 
 * // Clear all cached translations
 * clearTranslationCache();
 * ```
 */
export function clearTranslationCache(locale?: string): void {
  if (locale) {
    translationCache.delete(locale);
    console.log(`Cleared translation cache for ${locale}`);
  } else {
    translationCache.clear();
    console.log('Cleared all translation caches');
  }
}

/**
 * Check if a language is cached
 * Useful for determining whether a language switch will be instant or require loading
 * 
 * @param locale - The language code to check
 * @returns true if the language is cached, false otherwise
 * 
 * @example
 * ```typescript
 * if (isLanguageCached('de')) {
 *   console.log('German is ready to use!');
 * } else {
 *   console.log('German will need to be loaded');
 * }
 * ```
 */
export function isLanguageCached(locale: string): boolean {
  return translationCache.has(locale);
}

/**
 * Get cached translations synchronously
 * Returns undefined if not cached
 * 
 * @param locale - The language code to get
 * @returns Cached translations or undefined
 * 
 * @example
 * ```typescript
 * const cached = getCachedTranslations('de');
 * if (cached) {
 *   console.log('Using cached German translations');
 * }
 * ```
 */
export function getCachedTranslations(locale: string): TranslationDictionary | undefined {
  return translationCache.get(locale);
}

/**
 * Get all cached locale codes
 * Useful for debugging or displaying which languages are ready
 * 
 * @returns Array of locale codes that are currently cached
 * 
 * @example
 * ```typescript
 * const cached = getCachedLocales();
 * console.log('Cached languages:', cached); // ['en', 'de']
 * ```
 */
export function getCachedLocales(): string[] {
  return Array.from(translationCache.keys());
}

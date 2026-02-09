/**
 * Server Component I18n Support
 * 
 * This module provides translation functions for React Server Components.
 * Since Server Components can't access localStorage, we sync language preference
 * via cookies that are set by the client.
 * 
 * Features:
 * - Cookie-based locale detection for server-side rendering
 * - Translation function compatible with Server Components
 * - Same fallback behavior as client-side translations
 * - Type-safe translation keys
 */

import { cookies } from 'next/headers';
import { loadTranslations } from './loader';
import { 
  TranslationKey, 
  TranslationDictionary, 
  InterpolationParams,
  DEFAULT_LOCALE,
  COOKIE_NAME,
  SupportedLocale
} from './types';
import { isPluralRules, formatPlural } from './pluralization';

/**
 * Get current locale from cookies (set by client)
 * Server components can't access localStorage, so we sync via cookies
 * 
 * @returns Promise resolving to the current locale code
 * 
 * @example
 * ```typescript
 * const locale = await getServerLocale();
 * console.log(locale); // 'de' or 'en' (default)
 * ```
 */
async function getServerLocale(): Promise<string> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(COOKIE_NAME);
  return localeCookie?.value || DEFAULT_LOCALE;
}

/**
 * Get translations for server components
 * This function can be called in Server Components
 * 
 * @returns Object containing translation function and current locale
 * 
 * @example
 * ```tsx
 * // In a Server Component
 * export default async function Page() {
 *   const { t, locale } = await getTranslations();
 *   
 *   return (
 *     <div>
 *       <h1>{t('dashboard.title')}</h1>
 *       <p>Current language: {locale}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export async function getTranslations() {
  const locale = await getServerLocale();
  const translations = await loadTranslations(locale);

  /**
   * Translation function for server components
   * 
   * @param key - Translation key in dot notation
   * @param params - Optional parameters for interpolation
   * @returns Translated string
   */
  const t = (key: TranslationKey | string, params?: InterpolationParams): string => {
    // Navigate nested object using dot notation
    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found - log warning in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Server] Translation key not found: ${key} (locale: ${locale})`);
        }
        
        // Return the key itself as fallback
        return key;
      }
    }

    // Ensure we got a string
    if (typeof value !== 'string') {
      // Check if value is a plural rules object
      if (isPluralRules(value)) {
        // Handle pluralization
        const count = params?.count;
        
        if (typeof count !== 'number') {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Server] Plural translation requires 'count' parameter: ${key}`);
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
          console.warn(`[Server] Translation value is not a string: ${key} (got ${typeof value})`);
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
  };

  return {
    t,
    locale,
  };
}

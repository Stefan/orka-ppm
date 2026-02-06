/**
 * Property-Based Test: Translation Loader
 * Feature: complete-i18n-system, Property 8: Single language loaded on initialization
 * Validates: Requirements 1.2, 2.1
 */

import fc from 'fast-check';
import {
  loadTranslations,
  clearTranslationCache,
  isLanguageCached,
} from '../loader';
import { SupportedLocale, SUPPORTED_LANGUAGES } from '../types';

// Loader calls fetch(url, { cache: 'no-store' })
const FETCH_OPTIONS = { cache: 'no-store' as RequestCache };

// Mock fetch globally
global.fetch = jest.fn();

// Arbitrary for supported locales
const supportedLocaleArb = fc.constantFrom<SupportedLocale>(
  'en',
  'de',
  'fr',
  'es',
  'pl',
  'gsw'
);

// Arbitrary for translation dictionaries
const translationDictionaryArb = fc.dictionary(
  fc.string(),
  fc.oneof(
    fc.string(),
    fc.dictionary(fc.string(), fc.string())
  )
);

describe('Translation Loader Property Tests', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Loader reads from cache only when NODE_ENV === 'production'; set so cache tests pass
    process.env.NODE_ENV = 'production';
    clearTranslationCache();
    jest.clearAllMocks();
    // Suppress loader console output during tests (Property 6 tests trigger intentional errors and fallbacks)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorSpy?.mockRestore?.();
    consoleWarnSpy?.mockRestore?.();
    consoleLogSpy?.mockRestore?.();
  });

  /**
   * Property 8: Single language loaded on initialization
   * For any application start, only one translation file (the selected language) 
   * should be fetched, not all six languages
   */
  test('Property 8: Only the selected language should be loaded, not all languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        translationDictionaryArb,
        async (selectedLocale, translations) => {
          // Clear cache to simulate fresh application start
          clearTranslationCache();
          jest.clearAllMocks();

          // Mock fetch to track which locales are requested
          const fetchedLocales: string[] = [];
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            // Extract locale from URL
            const match = url.match(/\/locales\/(\w+)\.json/);
            if (match) {
              fetchedLocales.push(match[1]);
            }

            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // Load the selected language
          await loadTranslations(selectedLocale);

          // Verify only one language was fetched
          expect(fetchedLocales.length).toBe(1);
          expect(fetchedLocales[0]).toBe(selectedLocale);

          // Verify only the selected language is cached
          expect(isLanguageCached(selectedLocale)).toBe(true);

          // Verify other languages are NOT cached
          const otherLocales = SUPPORTED_LANGUAGES
            .map(lang => lang.code)
            .filter(code => code !== selectedLocale);

          otherLocales.forEach(locale => {
            expect(isLanguageCached(locale)).toBe(false);
          });

          // Verify fetch was called exactly once
          expect(global.fetch).toHaveBeenCalledTimes(1);
          expect(global.fetch).toHaveBeenCalledWith(`/locales/${selectedLocale}.json`, FETCH_OPTIONS);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (Extended): Multiple language loads should be independent
   * Loading one language should not trigger loading of other languages
   */
  test('Property 8: Loading multiple languages sequentially should only fetch each once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(supportedLocaleArb, { minLength: 2, maxLength: 4 }),
        translationDictionaryArb,
        async (locales, translations) => {
          // Clear cache to simulate fresh start
          clearTranslationCache();
          jest.clearAllMocks();

          // Track fetched locales
          const fetchedLocales: string[] = [];
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            if (match) {
              fetchedLocales.push(match[1]);
            }

            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // Load each locale sequentially
          for (const locale of locales) {
            await loadTranslations(locale);
          }

          // Get unique locales that were requested
          const uniqueLocales = Array.from(new Set(locales));

          // Verify only the requested locales were fetched
          expect(fetchedLocales.length).toBe(uniqueLocales.length);

          // Verify each unique locale was fetched exactly once
          uniqueLocales.forEach(locale => {
            const fetchCount = fetchedLocales.filter(l => l === locale).length;
            expect(fetchCount).toBe(1);
          });

          // Verify only requested locales are cached
          uniqueLocales.forEach(locale => {
            expect(isLanguageCached(locale)).toBe(true);
          });

          // Verify unrequested locales are NOT cached
          const unrequestedLocales = SUPPORTED_LANGUAGES
            .map(lang => lang.code)
            .filter(code => !uniqueLocales.includes(code));

          unrequestedLocales.forEach(locale => {
            expect(isLanguageCached(locale)).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (Extended): Concurrent loads of the same language should only fetch once
   * Multiple simultaneous requests for the same language should be deduplicated
   */
  test('Property 8: Concurrent loads of the same language should only fetch once', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        fc.integer({ min: 2, max: 10 }),
        translationDictionaryArb,
        async (locale, concurrentRequests, translations) => {
          // Clear cache to simulate fresh start
          clearTranslationCache();
          jest.clearAllMocks();

          // Track fetch calls
          let fetchCallCount = 0;
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            fetchCallCount++;
            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // Make multiple concurrent requests for the same locale
          const promises = Array(concurrentRequests)
            .fill(null)
            .map(() => loadTranslations(locale));

          // Wait for all to complete
          const results = await Promise.all(promises);

          // Verify only one fetch was made despite multiple concurrent requests
          expect(fetchCallCount).toBe(1);

          // Verify all requests got the same result
          results.forEach(result => {
            expect(result).toEqual(translations);
          });

          // Verify the locale is cached
          expect(isLanguageCached(locale)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (Extended): Lazy loading should not preload all languages
   * Even after loading one language, other languages should remain unloaded
   */
  test('Property 8: Loading one language should not trigger preloading of others', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        translationDictionaryArb,
        async (selectedLocale, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          // Mock fetch
          (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => translations,
          });

          // Load one language
          await loadTranslations(selectedLocale);

          // Wait a bit to ensure no background loading happens
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify only one fetch call was made
          expect(global.fetch).toHaveBeenCalledTimes(1);

          // Verify only the selected language is cached
          const cachedLocales = SUPPORTED_LANGUAGES
            .map(lang => lang.code)
            .filter(code => isLanguageCached(code));

          expect(cachedLocales).toEqual([selectedLocale]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (Extended): Cache should prevent redundant fetches
   * Once a language is loaded, subsequent requests should use cache
   */
  test('Property 8: Cached language should not trigger additional fetches', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        fc.integer({ min: 2, max: 5 }),
        translationDictionaryArb,
        async (locale, subsequentLoads, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          // Mock fetch
          (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => translations,
          });

          // First load
          await loadTranslations(locale);
          expect(global.fetch).toHaveBeenCalledTimes(1);

          // Clear mock call history but keep cache
          jest.clearAllMocks();

          // Subsequent loads
          for (let i = 0; i < subsequentLoads; i++) {
            await loadTranslations(locale);
          }

          // Verify no additional fetches were made
          expect(global.fetch).not.toHaveBeenCalled();

          // Verify locale is still cached
          expect(isLanguageCached(locale)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (Extended): Initial load should be minimal
   * Application start should only load one language file, minimizing initial bundle
   */
  test('Property 8: Application initialization should have minimal translation loading', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        translationDictionaryArb,
        async (initialLocale, translations) => {
          // Simulate fresh application start
          clearTranslationCache();
          jest.clearAllMocks();

          // Track network requests
          const networkRequests: string[] = [];
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            networkRequests.push(url);
            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // Simulate application initialization
          await loadTranslations(initialLocale);

          // Verify minimal network activity
          expect(networkRequests.length).toBe(1);
          expect(networkRequests[0]).toBe(`/locales/${initialLocale}.json`);

          // Verify no other translation files were requested
          const allLocales = SUPPORTED_LANGUAGES.map(lang => lang.code);
          const otherLocaleRequests = networkRequests.filter(url => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            return match && match[1] !== initialLocale && allLocales.includes(match[1] as SupportedLocale);
          });

          expect(otherLocaleRequests.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Cache prevents redundant network requests
   * For any language that has been loaded once, selecting that language again 
   * should retrieve translations from cache without making a network request
   * Validates: Requirements 2.3, 18.3
   */
  test('Property 5: Cache prevents redundant network requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        fc.integer({ min: 1, max: 10 }),
        translationDictionaryArb,
        async (locale, repeatLoads, translations) => {
          // Clear cache to start fresh
          clearTranslationCache();
          jest.clearAllMocks();

          // Mock fetch to track calls
          let fetchCallCount = 0;
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            fetchCallCount++;
            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // First load - should fetch from network
          const firstResult = await loadTranslations(locale);
          expect(fetchCallCount).toBe(1);
          expect(firstResult).toEqual(translations);
          expect(isLanguageCached(locale)).toBe(true);

          // Reset fetch call count but keep the mock implementation
          const originalMock = (global.fetch as jest.Mock).getMockImplementation();
          jest.clearAllMocks();
          (global.fetch as jest.Mock).mockImplementation(originalMock!);
          fetchCallCount = 0;

          // Subsequent loads - should use cache, no network requests
          for (let i = 0; i < repeatLoads; i++) {
            const cachedResult = await loadTranslations(locale);
            expect(cachedResult).toEqual(translations);
            expect(cachedResult).toBe(firstResult); // Same object reference
          }

          // Verify no additional network requests were made
          expect(fetchCallCount).toBe(0);
          expect(global.fetch).not.toHaveBeenCalled();

          // Verify locale is still cached
          expect(isLanguageCached(locale)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (Extended): Cache persists across different access patterns
   * Cache should work regardless of how translations are accessed
   */
  test('Property 5: Cache works with mixed access patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(supportedLocaleArb, { minLength: 2, maxLength: 4 }),
        translationDictionaryArb,
        async (locales, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          // Track fetch calls per locale
          const fetchCounts = new Map<string, number>();
          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            if (match) {
              const locale = match[1];
              fetchCounts.set(locale, (fetchCounts.get(locale) || 0) + 1);
            }
            return Promise.resolve({
              ok: true,
              json: async () => translations,
            });
          });

          // Load each locale multiple times in random order
          const loadSequence = [...locales, ...locales, ...locales];
          
          for (const locale of loadSequence) {
            await loadTranslations(locale);
          }

          // Verify each unique locale was fetched exactly once
          const uniqueLocales = Array.from(new Set(locales));
          uniqueLocales.forEach(locale => {
            expect(fetchCounts.get(locale)).toBe(1);
            expect(isLanguageCached(locale)).toBe(true);
          });

          // Total fetches should equal unique locales
          const totalFetches = Array.from(fetchCounts.values()).reduce((a, b) => a + b, 0);
          expect(totalFetches).toBe(uniqueLocales.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (Extended): Cache survives concurrent requests
   * Multiple concurrent requests should still result in only one fetch
   */
  test('Property 5: Cache prevents redundant requests even with concurrent access', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        fc.integer({ min: 3, max: 10 }),
        translationDictionaryArb,
        async (locale, concurrentCount, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let fetchCallCount = 0;
          (global.fetch as jest.Mock).mockImplementation(() => {
            fetchCallCount++;
            // Add small delay to simulate network
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({
                  ok: true,
                  json: async () => translations,
                });
              }, 10);
            });
          });

          // Make concurrent requests
          const promises = Array(concurrentCount)
            .fill(null)
            .map(() => loadTranslations(locale));

          const results = await Promise.all(promises);

          // Should only fetch once despite concurrent requests
          expect(fetchCallCount).toBe(1);

          // All results should be identical
          results.forEach(result => {
            expect(result).toEqual(translations);
          });

          // Locale should be cached
          expect(isLanguageCached(locale)).toBe(true);

          // Subsequent request should use cache
          jest.clearAllMocks();
          fetchCallCount = 0;
          
          await loadTranslations(locale);
          expect(fetchCallCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Network error retry logic
   * For any translation file fetch that fails due to network error, 
   * the system should retry exactly once before falling back to English
   * Validates: Requirements 2.5, 19.3
   */
  test('Property 7: Network error triggers exactly one retry before fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb.filter(locale => locale !== 'en'), // Exclude English
        translationDictionaryArb,
        async (locale, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let fetchCallCount = 0;
          let englishFetchCount = 0;

          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            const requestedLocale = match ? match[1] : '';

            if (requestedLocale === 'en') {
              englishFetchCount++;
              return Promise.resolve({
                ok: true,
                json: async () => translations,
              });
            }

            fetchCallCount++;
            
            // Fail both initial and retry attempts
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => { throw new Error('Network error'); },
            });
          });

          // Attempt to load the locale
          const result = await loadTranslations(locale);

          // Should have tried the locale twice (initial + retry)
          expect(fetchCallCount).toBe(2);

          // Should have fallen back to English once
          expect(englishFetchCount).toBe(1);

          // Result should be the English translations
          expect(result).toEqual(translations);

          // English should be cached, but not the failed locale
          expect(isLanguageCached('en')).toBe(true);
          expect(isLanguageCached(locale)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (Extended): Retry succeeds on second attempt
   * If the retry succeeds, should cache and return the translations
   */
  test('Property 7: Successful retry caches translations without fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb,
        translationDictionaryArb,
        async (locale, translations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let fetchCallCount = 0;

          (global.fetch as jest.Mock).mockImplementation(() => {
            fetchCallCount++;
            
            // Fail first attempt, succeed on retry
            if (fetchCallCount === 1) {
              return Promise.resolve({
                ok: false,
                status: 503,
                json: async () => { throw new Error('Service unavailable'); },
              });
            } else {
              return Promise.resolve({
                ok: true,
                json: async () => translations,
              });
            }
          });

          // Load translations
          const result = await loadTranslations(locale);

          // Should have made exactly 2 fetch attempts
          expect(fetchCallCount).toBe(2);

          // Should have succeeded and cached the result
          expect(result).toEqual(translations);
          expect(isLanguageCached(locale)).toBe(true);

          // Subsequent load should use cache
          jest.clearAllMocks();
          fetchCallCount = 0;
          
          await loadTranslations(locale);
          expect(fetchCallCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (Extended): English fallback does not retry
   * When English itself fails, should not enter infinite retry loop
   */
  test('Property 7: English fallback failure returns empty object without infinite retry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('en'),
        async (locale) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let fetchCallCount = 0;

          (global.fetch as jest.Mock).mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({
              ok: false,
              status: 404,
              json: async () => { throw new Error('Not found'); },
            });
          });

          // Attempt to load English
          const result = await loadTranslations(locale);

          // Should have tried twice (initial + retry) but not more
          expect(fetchCallCount).toBe(2);

          // Should return empty object as last resort
          expect(result).toEqual({});

          // Should not be cached
          expect(isLanguageCached(locale)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Malformed JSON fallback
   * For any translation file that contains invalid JSON, the system should 
   * log an error and fall back to loading the English translation file
   * Validates: Requirements 1.4, 19.2
   */
  test('Property 6: Malformed JSON triggers fallback to English', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb.filter(locale => locale !== 'en'),
        translationDictionaryArb,
        async (locale, validTranslations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let localeAttempts = 0;
          let englishAttempts = 0;

          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            const requestedLocale = match ? match[1] : '';

            if (requestedLocale === 'en') {
              englishAttempts++;
              return Promise.resolve({
                ok: true,
                json: async () => validTranslations,
              });
            }

            localeAttempts++;
            
            // Return malformed JSON
            return Promise.resolve({
              ok: true,
              json: async () => {
                throw new SyntaxError('Unexpected token in JSON');
              },
            });
          });

          // Attempt to load the locale
          const result = await loadTranslations(locale);

          // Should have tried the locale twice (initial + retry)
          expect(localeAttempts).toBe(2);

          // Should have fallen back to English
          expect(englishAttempts).toBe(1);

          // Result should be the English translations
          expect(result).toEqual(validTranslations);

          // English should be cached, but not the failed locale
          expect(isLanguageCached('en')).toBe(true);
          expect(isLanguageCached(locale)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Extended): Invalid translation structure triggers fallback
   * Non-object translations should be rejected and trigger fallback
   */
  test('Property 6: Invalid translation structure (non-object) triggers fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb.filter(locale => locale !== 'en'),
        fc.oneof(
          fc.constant(null),
          fc.constant('string'),
          fc.constant(123),
          fc.constant(true),
          fc.constant([])
        ),
        translationDictionaryArb,
        async (locale, invalidData, validTranslations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let localeAttempts = 0;
          let englishAttempts = 0;

          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            const requestedLocale = match ? match[1] : '';

            if (requestedLocale === 'en') {
              englishAttempts++;
              return Promise.resolve({
                ok: true,
                json: async () => validTranslations,
              });
            }

            localeAttempts++;
            
            // Return invalid structure
            return Promise.resolve({
              ok: true,
              json: async () => invalidData,
            });
          });

          // Attempt to load the locale
          const result = await loadTranslations(locale);

          // Should have tried the locale twice (initial + retry)
          expect(localeAttempts).toBe(2);

          // Should have fallen back to English
          expect(englishAttempts).toBe(1);

          // Result should be the English translations
          expect(result).toEqual(validTranslations);

          // English should be cached
          expect(isLanguageCached('en')).toBe(true);
          expect(isLanguageCached(locale)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Extended): Malformed JSON on retry also triggers fallback
   * Even if retry returns malformed JSON, should still fall back to English
   */
  test('Property 6: Malformed JSON on both attempts triggers fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedLocaleArb.filter(locale => locale !== 'en'),
        translationDictionaryArb,
        async (locale, validTranslations) => {
          // Clear cache
          clearTranslationCache();
          jest.clearAllMocks();

          let localeAttempts = 0;

          (global.fetch as jest.Mock).mockImplementation((url: string) => {
            const match = url.match(/\/locales\/(\w+)\.json/);
            const requestedLocale = match ? match[1] : '';

            if (requestedLocale === 'en') {
              return Promise.resolve({
                ok: true,
                json: async () => validTranslations,
              });
            }

            localeAttempts++;
            
            // Both attempts return malformed JSON
            return Promise.resolve({
              ok: true,
              json: async () => {
                throw new SyntaxError('Unexpected end of JSON input');
              },
            });
          });

          // Attempt to load the locale
          const result = await loadTranslations(locale);

          // Should have tried the locale twice
          expect(localeAttempts).toBe(2);

          // Should have fallen back to English and got valid translations
          expect(result).toEqual(validTranslations);
          expect(isLanguageCached('en')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

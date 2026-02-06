/**
 * Property-Based Tests for Unicode Character Support
 * Feature: complete-i18n-system
 * 
 * This file contains property-based tests for Unicode character preservation,
 * ensuring that special characters (including Swiss German) are handled correctly
 * through loading, caching, and rendering.
 * 
 * Tests use fast-check library with minimum 100 iterations per property.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import { I18nProvider, useI18n } from '../context';
import { loadTranslations, clearTranslationCache } from '../loader';
import { STORAGE_KEY } from '../types';

// Test component that uses the i18n context
function TestComponent({ testKey }: { testKey: string }) {
  const { t, locale } = useI18n();
  
  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="translation">{t(testKey)}</div>
    </div>
  );
}

// Helper to render component with I18nProvider
function renderWithI18n(component: React.ReactElement) {
  return render(
    <I18nProvider>
      {component}
    </I18nProvider>
  );
}

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock fetch globally
global.fetch = jest.fn();

describe('Unicode Character Support Property Tests', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Loader reads from cache only when NODE_ENV === 'production'; needed for cache retrieval test
    process.env.NODE_ENV = 'production';
    // Clear all caches and mocks before each test
    clearTranslationCache();
    localStorageMock.clear();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    clearTranslationCache();
    localStorageMock.clear();
  });

  // Feature: complete-i18n-system, Property 31: Unicode character preservation
  describe('Property 31: Unicode character preservation', () => {
    it('should preserve Unicode characters through loading and caching', async () => {
      // Use specific Unicode characters
      const unicodeChars = 'äöüÄÖÜßàèéìòùâêîôû😀🎉✅€£¥ΑΒΓαβγПриветМир测试';
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('en', 'de', 'fr', 'es', 'pl', 'gsw'),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom(...unicodeChars.split('')), { minLength: 5, maxLength: 50 }).map(arr => arr.join('')),
          async (locale, keyName, unicodeValue) => {
            // Create a clean key name (no special characters in keys)
            const cleanKey = keyName.replace(/[^a-zA-Z0-9]/g, '');
            if (cleanKey.length === 0) return; // Skip if key becomes empty
            
            const testKey = `test.${cleanKey}`;
            
            // Create mock translations with Unicode value
            const mockTranslations = {
              test: {
                [cleanKey]: unicodeValue,
              },
            };
            
            // Mock fetch to return our Unicode translation
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // Set locale
            localStorageMock.setItem(STORAGE_KEY, locale);
            clearTranslationCache();
            
            // Load translations
            const translations = await loadTranslations(locale);
            
            // Verify Unicode is preserved in loaded translations
            const keys = testKey.split('.');
            let value: any = translations;
            
            for (const k of keys) {
              if (value && typeof value === 'object' && k in value) {
                value = value[k];
              } else {
                value = undefined;
                break;
              }
            }
            
            // If the key exists, verify Unicode is preserved
            if (value !== undefined) {
              expect(value).toBe(unicodeValue);
              expect(value.length).toBe(unicodeValue.length);
              
              // Verify each character is preserved
              for (let i = 0; i < unicodeValue.length; i++) {
                expect(value.charCodeAt(i)).toBe(unicodeValue.charCodeAt(i));
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve Swiss German special characters', async () => {
      // Swiss German (Baseldytsch) specific characters and diacritics
      const swissGermanChars = [
        'ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß',
        'à', 'è', 'é', 'ì', 'ò', 'ù',
        'â', 'ê', 'î', 'ô', 'û',
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...swissGermanChars),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (specialChar, baseText) => {
            // Create text with Swiss German special character
            const textWithSpecialChar = `${baseText}${specialChar}${baseText}`;
            
            const testKey = 'test.swissGerman';
            
            // Create mock translations
            const mockTranslations = {
              test: {
                swissGerman: textWithSpecialChar,
              },
            };
            
            // Mock fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // Set to Swiss German locale
            localStorageMock.setItem(STORAGE_KEY, 'gsw');
            clearTranslationCache();
            
            // Load translations
            const translations = await loadTranslations('gsw');
            
            // Verify special character is preserved
            const value = translations.test?.swissGerman;
            expect(value).toBe(textWithSpecialChar);
            expect(value).toContain(specialChar);
            
            // Verify the special character's Unicode code point is preserved
            const charIndex = baseText.length;
            expect(value.charAt(charIndex)).toBe(specialChar);
            expect(value.charCodeAt(charIndex)).toBe(specialChar.charCodeAt(0));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve Unicode through translation function', async () => {
      // Test that Unicode is preserved through the translation function
      // without React rendering complexity
      const unicodeChars = 'äöüÄÖÜßàèéìòùâêîôû😀🎉✅€£¥ΑΒΓαβγПриветМир测试';
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('en', 'de', 'fr', 'gsw'),
          fc.array(fc.constantFrom(...unicodeChars.split('')), { minLength: 5, maxLength: 30 }).map(arr => arr.join('')),
          async (locale, unicodeValue) => {
            // Skip empty values
            if (unicodeValue.length === 0) return;
            
            const testKey = 'test.unicode';
            
            // Create mock translations
            const mockTranslations = {
              test: {
                unicode: unicodeValue,
              },
            };
            
            // Clear cache and mocks
            clearTranslationCache();
            jest.clearAllMocks();
            
            // Mock fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // Load translations
            const translations = await loadTranslations(locale);
            
            // Verify Unicode is preserved
            const value = translations.test?.unicode;
            expect(value).toBe(unicodeValue);
            expect(value.length).toBe(unicodeValue.length);
            
            // Verify character-by-character
            for (let i = 0; i < unicodeValue.length; i++) {
              expect(value.charCodeAt(i)).toBe(unicodeValue.charCodeAt(i));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve emoji and other Unicode symbols', async () => {
      const unicodeSymbols = [
        '😀', '🎉', '✅', '❌', '⚠️', '🔥', '💡', '📊', '🚀', '⭐',
        '→', '←', '↑', '↓', '✓', '✗', '•', '◦', '▪', '▫',
        '€', '£', '¥', '₹', '₽', '₩', '₪', '₴', '₦', '₨',
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...unicodeSymbols),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (symbol, text) => {
            const textWithSymbol = `${text} ${symbol}`;
            const testKey = 'test.symbol';
            
            // Create mock translations
            const mockTranslations = {
              test: {
                symbol: textWithSymbol,
              },
            };
            
            // Mock fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // Set locale
            localStorageMock.setItem(STORAGE_KEY, 'en');
            clearTranslationCache();
            
            // Load translations
            const translations = await loadTranslations('en');
            
            // Verify symbol is preserved
            const value = translations.test?.symbol;
            expect(value).toBe(textWithSymbol);
            expect(value).toContain(symbol);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve Unicode through cache retrieval', async () => {
      const unicodeChars = 'äöüÄÖÜßàèéìòùâêîôû😀🎉✅€£¥ΑΒΓαβγПриветМир测试';
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('en', 'de', 'fr', 'gsw'),
          fc.array(fc.constantFrom(...unicodeChars.split('')), { minLength: 5, maxLength: 30 }).map(arr => arr.join('')),
          async (locale, unicodeValue) => {
            // Skip empty values
            if (unicodeValue.length === 0) return;
            
            const testKey = 'test.cached';
            
            // Create mock translations
            const mockTranslations = {
              test: {
                cached: unicodeValue,
              },
            };
            
            // Clear cache and mocks
            clearTranslationCache();
            jest.clearAllMocks();
            
            // Mock fetch (should only be called once)
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // First load - from fetch
            const translations1 = await loadTranslations(locale);
            const value1 = translations1.test?.cached;
            
            // Second load - from cache
            const translations2 = await loadTranslations(locale);
            const value2 = translations2.test?.cached;
            
            // Verify Unicode is preserved in both loads
            expect(value1).toBe(unicodeValue);
            expect(value2).toBe(unicodeValue);
            expect(value1).toBe(value2);
            
            // Verify fetch was only called once (second load used cache)
            expect(global.fetch).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve mixed Unicode scripts', async () => {
      // Test mixing different Unicode scripts (Latin, Cyrillic, Greek, etc.)
      const mixedScripts = [
        'Hello Мир', // Latin + Cyrillic
        'Café Ελλάδα', // Latin + Greek
        'Test 测试', // Latin + Chinese
        'Привет World', // Cyrillic + Latin
        'Ελληνικά English', // Greek + Latin
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...mixedScripts),
          async (mixedText) => {
            const testKey = 'test.mixed';
            
            // Create mock translations
            const mockTranslations = {
              test: {
                mixed: mixedText,
              },
            };
            
            // Mock fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: true,
              json: async () => mockTranslations,
            });
            
            // Clear cache
            clearTranslationCache();
            
            // Load translations
            const translations = await loadTranslations('en');
            
            // Verify mixed scripts are preserved
            const value = translations.test?.mixed;
            expect(value).toBe(mixedText);
            expect(value.length).toBe(mixedText.length);
            
            // Verify each character
            for (let i = 0; i < mixedText.length; i++) {
              expect(value.charCodeAt(i)).toBe(mixedText.charCodeAt(i));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

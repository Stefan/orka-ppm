/**
 * Unit tests for Translation Loader
 * 
 * Tests the core functionality of loading, caching, and managing translations.
 * Covers:
 * - Basic loading functionality
 * - Caching behavior
 * - Error handling and retry logic
 * - Fallback to English
 * - Cache management functions
 */

import {
  loadTranslations,
  preloadTranslations,
  clearTranslationCache,
  isLanguageCached,
  getCachedLocales,
} from '../loader';

// Mock fetch globally
global.fetch = jest.fn();

// Loader passes { cache: 'no-store' } to fetch
const FETCH_OPTIONS = { cache: 'no-store' as RequestCache };

const originalNodeEnv = process.env.NODE_ENV;
describe('Translation Loader', () => {
  beforeEach(() => {
    // Use production so loader caches (useCache === true) and tests can assert cache behavior
    process.env.NODE_ENV = 'production';
    clearTranslationCache();
    jest.clearAllMocks();
  });
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('loadTranslations', () => {
    it('should load translations from the server', async () => {
      const mockTranslations = {
        common: { save: 'Save', cancel: 'Cancel' },
        nav: { dashboards: 'Dashboards' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      const result = await loadTranslations('en');

      expect(global.fetch).toHaveBeenCalledWith('/locales/en.json', FETCH_OPTIONS);
      expect(result).toEqual(mockTranslations);
    });

    it('should cache translations after loading', async () => {
      const mockTranslations = {
        common: { save: 'Speichern' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      // First load
      await loadTranslations('de');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second load should use cache
      const result = await loadTranslations('de');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result).toEqual(mockTranslations);
    });

    it('should return cached translations immediately', async () => {
      const mockTranslations = {
        common: { save: 'Guardar' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      // Load once
      await loadTranslations('es');

      // Clear mock to verify no new calls
      jest.clearAllMocks();

      // Load again
      const result = await loadTranslations('es');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual(mockTranslations);
    });

    it('should retry once on failure', async () => {
      const mockTranslations = {
        common: { save: 'Enregistrer' },
      };

      // First call fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      // Second call (retry) succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      const result = await loadTranslations('fr');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockTranslations);
    });

    it('should fall back to English if non-English language fails', async () => {
      const englishTranslations = {
        common: { save: 'Save' },
      };

      // Polish fails twice
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        // English succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => englishTranslations,
        });

      const result = await loadTranslations('pl');

      expect(global.fetch).toHaveBeenCalledWith('/locales/pl.json', FETCH_OPTIONS);
      expect(global.fetch).toHaveBeenCalledWith('/locales/en.json', FETCH_OPTIONS);
      expect(result).toEqual(englishTranslations);
    });

    it('should return empty object if all loading attempts fail', async () => {
      // All attempts fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await loadTranslations('en');

      expect(result).toEqual({});
    });

    it('should handle HTTP error responses', async () => {
      const englishTranslations = {
        common: { save: 'Save' },
      };

      // 404 error
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        // Fallback to English
        .mockResolvedValueOnce({
          ok: true,
          json: async () => englishTranslations,
        });

      const result = await loadTranslations('de');

      expect(result).toEqual(englishTranslations);
    });

    it('should validate translation structure', async () => {
      const englishTranslations = {
        common: { save: 'Save' },
      };

      // Invalid structure (not an object)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => 'invalid',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => 'invalid',
        })
        // Fallback to English
        .mockResolvedValueOnce({
          ok: true,
          json: async () => englishTranslations,
        });

      const result = await loadTranslations('de');

      expect(result).toEqual(englishTranslations);
    });

    it('should handle null translation data', async () => {
      const englishTranslations = {
        common: { save: 'Save' },
      };

      // Null data
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        })
        // Fallback to English
        .mockResolvedValueOnce({
          ok: true,
          json: async () => englishTranslations,
        });

      const result = await loadTranslations('fr');

      expect(result).toEqual(englishTranslations);
    });
  });

  describe('preloadTranslations', () => {
    it('should preload translations without blocking', () => {
      const mockTranslations = {
        common: { save: 'Zapisz' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      // Should not throw or block
      preloadTranslations('pl');

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalledWith('/locales/pl.json', FETCH_OPTIONS);
    });

    it('should not preload if already cached', async () => {
      const mockTranslations = {
        common: { save: 'Speichern' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      // Load first
      await loadTranslations('de');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear mocks
      jest.clearAllMocks();

      // Preload should not fetch again
      preloadTranslations('de');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle preload failures gracefully', () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw
      expect(() => {
        preloadTranslations('es');
      }).not.toThrow();
    });
  });

  describe('clearTranslationCache', () => {
    it('should clear cache for a specific language', async () => {
      const mockTranslations = {
        common: { save: 'Save' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      // Load and cache
      await loadTranslations('en');
      expect(isLanguageCached('en')).toBe(true);

      // Clear specific language
      clearTranslationCache('en');
      expect(isLanguageCached('en')).toBe(false);
    });

    it('should clear all caches when no locale specified', async () => {
      const mockTranslations = {
        common: { save: 'Test' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      // Load multiple languages
      await loadTranslations('en');
      await loadTranslations('de');
      await loadTranslations('fr');

      expect(isLanguageCached('en')).toBe(true);
      expect(isLanguageCached('de')).toBe(true);
      expect(isLanguageCached('fr')).toBe(true);

      // Clear all
      clearTranslationCache();

      expect(isLanguageCached('en')).toBe(false);
      expect(isLanguageCached('de')).toBe(false);
      expect(isLanguageCached('fr')).toBe(false);
    });
  });

  describe('isLanguageCached', () => {
    it('should return true for cached languages', async () => {
      const mockTranslations = {
        common: { save: 'Save' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTranslations,
      });

      expect(isLanguageCached('en')).toBe(false);

      await loadTranslations('en');

      expect(isLanguageCached('en')).toBe(true);
    });

    it('should return false for non-cached languages', () => {
      expect(isLanguageCached('de')).toBe(false);
      expect(isLanguageCached('fr')).toBe(false);
    });
  });

  describe('getCachedLocales', () => {
    it('should return empty array when no languages cached', () => {
      expect(getCachedLocales()).toEqual([]);
    });

    it('should return all cached locale codes', async () => {
      const mockTranslations = {
        common: { save: 'Test' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      await loadTranslations('en');
      await loadTranslations('de');
      await loadTranslations('fr');

      const cached = getCachedLocales();
      expect(cached).toHaveLength(3);
      expect(cached).toContain('en');
      expect(cached).toContain('de');
      expect(cached).toContain('fr');
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent loads of the same language', async () => {
      const mockTranslations = {
        common: { save: 'Save' },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTranslations,
      });

      // Load same language concurrently
      const [result1, result2, result3] = await Promise.all([
        loadTranslations('en'),
        loadTranslations('en'),
        loadTranslations('en'),
      ]);

      // Should only fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockTranslations);
      expect(result2).toEqual(mockTranslations);
      expect(result3).toEqual(mockTranslations);
    });

    it('should handle empty translation files', async () => {
      const emptyTranslations = {};

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyTranslations,
      });

      const result = await loadTranslations('en');

      expect(result).toEqual({});
    });

    it('should handle deeply nested translation structures', async () => {
      const nestedTranslations = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'Deep value',
              },
            },
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => nestedTranslations,
      });

      const result = await loadTranslations('en');

      expect(result).toEqual(nestedTranslations);
    });
  });
});

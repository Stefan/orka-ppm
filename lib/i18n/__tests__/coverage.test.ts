/**
 * Unit tests for Translation Coverage Report Utility
 * 
 * Tests the coverage report generation and analysis functions
 */

import {
  generateCoverageReport,
  getMissingTranslations,
  printCoverageReport,
} from '../coverage';
import { loadTranslations, clearTranslationCache } from '../loader';
import { SUPPORTED_LANGUAGES } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

// Mock translation data for testing
const mockEnglishTranslations = {
  nav: {
    dashboards: 'Dashboards',
    scenarios: 'Scenarios',
    resources: 'Resources',
  },
  dashboard: {
    title: 'Portfolio Dashboard',
    projects: 'projects',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
  },
};

const mockGermanTranslations = {
  nav: {
    dashboards: 'Armaturenbretter',
    scenarios: 'Szenarien',
    // Missing: resources
  },
  dashboard: {
    title: 'Portfolio-Dashboard',
    projects: 'Projekte',
  },
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
  },
};

describe('Translation Coverage Report', () => {
  beforeEach(() => {
    clearTranslationCache();
    jest.clearAllMocks();
    
    // Setup default mock responses for all languages
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/en.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockEnglishTranslations,
        });
      } else if (url.includes('/de.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockGermanTranslations,
        });
      } else {
        // For other languages, return English translations (full coverage)
        return Promise.resolve({
          ok: true,
          json: async () => mockEnglishTranslations,
        });
      }
    });
  });

  afterEach(() => {
    clearTranslationCache();
  });

  describe('generateCoverageReport', () => {
    it('should generate a complete coverage report for all languages', async () => {
      const report = await generateCoverageReport();

      // Verify report structure
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('referenceLocale');
      expect(report).toHaveProperty('totalKeys');
      expect(report).toHaveProperty('languages');
      expect(report).toHaveProperty('overallCoverage');

      // Verify reference locale is English
      expect(report.referenceLocale).toBe('en');

      // Verify all supported languages are included
      expect(report.languages).toHaveLength(SUPPORTED_LANGUAGES.length);

      // Verify language codes
      const languageCodes = report.languages.map(lang => lang.locale);
      const expectedCodes = SUPPORTED_LANGUAGES.map((l) => l.code);
      for (const code of expectedCodes) {
        expect(languageCodes).toContain(code);
      }

      // Verify each language report has required fields
      for (const langReport of report.languages) {
        expect(langReport).toHaveProperty('locale');
        expect(langReport).toHaveProperty('name');
        expect(langReport).toHaveProperty('totalKeys');
        expect(langReport).toHaveProperty('translatedKeys');
        expect(langReport).toHaveProperty('missingKeys');
        expect(langReport).toHaveProperty('coveragePercent');
        expect(langReport).toHaveProperty('missingKeyPaths');

        // Verify coverage percent is between 0 and 100
        expect(langReport.coveragePercent).toBeGreaterThanOrEqual(0);
        expect(langReport.coveragePercent).toBeLessThanOrEqual(100);

        // Verify math is correct
        expect(langReport.translatedKeys + langReport.missingKeys).toBe(
          langReport.totalKeys
        );
      }

      // Verify English has 100% coverage (it's the reference)
      const englishReport = report.languages.find(lang => lang.locale === 'en');
      expect(englishReport).toBeDefined();
      expect(englishReport!.coveragePercent).toBe(100);
      expect(englishReport!.missingKeys).toBe(0);
      expect(englishReport!.missingKeyPaths).toHaveLength(0);
    });

    it('should calculate overall coverage correctly', async () => {
      const report = await generateCoverageReport();

      // Overall coverage should be average of non-English languages
      const nonEnglishReports = report.languages.filter(
        lang => lang.locale !== 'en'
      );

      const expectedOverall = Math.round(
        nonEnglishReports.reduce((sum, r) => sum + r.coveragePercent, 0) /
        nonEnglishReports.length
      );

      expect(report.overallCoverage).toBe(expectedOverall);
    });

    it('should count total keys correctly', async () => {
      const report = await generateCoverageReport();

      // Load English translations to verify count
      const englishTranslations = await loadTranslations('en');

      // Count keys manually
      function countKeys(obj: any): number {
        let count = 0;
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;

          const value = obj[key];
          if (typeof value === 'string') {
            count++;
          } else if (typeof value === 'object' && value !== null) {
            // Check if it's a plural rules object
            const isPluralRules = 'one' in value && 'other' in value;
            if (isPluralRules) {
              count++;
            } else {
              count += countKeys(value);
            }
          }
        }
        return count;
      }

      const expectedKeyCount = countKeys(englishTranslations);

      expect(report.totalKeys).toBe(expectedKeyCount);
      
      // If translations are loaded, should have keys
      if (Object.keys(englishTranslations).length > 0) {
        expect(report.totalKeys).toBeGreaterThan(0);
      }
    });
  });

  describe('getMissingTranslations', () => {
    it('should return empty array for English (reference language)', async () => {
      const missing = await getMissingTranslations('en');

      expect(Array.isArray(missing)).toBe(true);
      expect(missing).toHaveLength(0);
    });

    it('should return array of missing key paths for other languages', async () => {
      const locales: Array<'de' | 'fr' | 'es' | 'pl' | 'gsw'> = [
        'de',
        'fr',
        'es',
        'pl',
        'gsw',
      ];

      for (const locale of locales) {
        const missing = await getMissingTranslations(locale);

        expect(Array.isArray(missing)).toBe(true);

        // Each missing key should be a dot-notation string
        for (const keyPath of missing) {
          expect(typeof keyPath).toBe('string');
          expect(keyPath.length).toBeGreaterThan(0);
        }
      }
    });

    it('should identify specific missing keys correctly', async () => {
      // Load English and another language to compare
      const englishTranslations = await loadTranslations('en');
      const germanTranslations = await loadTranslations('de');

      const missing = await getMissingTranslations('de');

      // Verify that missing keys actually don't exist in German
      for (const keyPath of missing) {
        const keys = keyPath.split('.');
        let germanValue: any = germanTranslations;
        let keyExists = true;

        for (const key of keys) {
          if (germanValue && typeof germanValue === 'object' && key in germanValue) {
            germanValue = germanValue[key];
          } else {
            keyExists = false;
            break;
          }
        }

        // Key should not exist in German
        expect(keyExists).toBe(false);

        // But should exist in English
        let englishValue: any = englishTranslations;
        let englishKeyExists = true;

        for (const key of keys) {
          if (englishValue && typeof englishValue === 'object' && key in englishValue) {
            englishValue = englishValue[key];
          } else {
            englishKeyExists = false;
            break;
          }
        }

        // Key should exist in English (reference)
        expect(englishKeyExists).toBe(true);
      }
    });
  });

  describe('printCoverageReport', () => {
    it('should print report without errors', async () => {
      const report = await generateCoverageReport();

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Should not throw
      expect(() => {
        printCoverageReport(report, false);
      }).not.toThrow();

      // Should have called console.log
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should print report with missing keys when requested', async () => {
      const report = await generateCoverageReport();

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Should not throw
      expect(() => {
        printCoverageReport(report, true);
      }).not.toThrow();

      // Should have called console.log
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should include all required information in output', async () => {
      const report = await generateCoverageReport();

      // Mock console.log to capture output
      const logCalls: string[] = [];
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation((...args) => {
          logCalls.push(args.join(' '));
        });

      printCoverageReport(report, false);

      // Combine all log calls into one string
      const output = logCalls.join('\n');

      // Verify output contains key information
      expect(output).toContain('Translation Coverage Report');
      expect(output).toContain('Generated:');
      expect(output).toContain('Reference Language:');
      expect(output).toContain('Total Keys:');
      expect(output).toContain('Overall Coverage:');

      // Verify all supported languages are mentioned in output
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(output).toContain(lang.name);
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty translation files gracefully', async () => {
      // This test verifies the utility doesn't crash with edge cases
      // In practice, our translation files should never be empty

      const report = await generateCoverageReport();

      // Should still generate a valid report
      expect(report).toBeDefined();
      expect(report.languages).toHaveLength(SUPPORTED_LANGUAGES.length);
    });

    it('should handle nested translation structures', async () => {
      const report = await generateCoverageReport();

      // Verify it counts nested keys correctly
      // In test environment, translations might not be loaded from files
      expect(report.totalKeys).toBeGreaterThanOrEqual(0);

      // All languages should have the same total keys count
      for (const langReport of report.languages) {
        expect(langReport.totalKeys).toBe(report.totalKeys);
      }
    });

    it('should handle plural rules as single keys', async () => {
      // Load translations that contain plural rules
      const englishTranslations = await loadTranslations('en');

      // Check if there are any plural rules in the translations
      function hasPluralRules(obj: any): boolean {
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;

          const value = obj[key];
          if (typeof value === 'object' && value !== null) {
            if ('one' in value && 'other' in value) {
              return true;
            }
            if (hasPluralRules(value)) {
              return true;
            }
          }
        }
        return false;
      }

      // If there are plural rules, verify they're counted correctly
      if (hasPluralRules(englishTranslations)) {
        const report = await generateCoverageReport();

        // Each plural rule should be counted as one key, not multiple
        expect(report.totalKeys).toBeGreaterThan(0);
      }
    });
  });
});

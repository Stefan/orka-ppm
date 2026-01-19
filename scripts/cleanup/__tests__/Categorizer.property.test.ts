/**
 * Property-Based Tests for Categorizer
 * 
 * These tests verify universal properties that should hold true across all inputs
 * using property-based testing with fast-check.
 */

import fc from 'fast-check';
import { Categorizer } from '../Categorizer';
import { FileScanner } from '../FileScanner';
import { SqlReferenceChecker } from '../SqlReferenceChecker';
import { FileInfo, FileCategory } from '../types';

describe('Categorizer - Property-Based Tests', () => {
  let categorizer: Categorizer;
  let scanner: FileScanner;
  let sqlChecker: SqlReferenceChecker;

  beforeEach(() => {
    scanner = new FileScanner(process.cwd());
    sqlChecker = new SqlReferenceChecker(process.cwd());
    categorizer = new Categorizer(scanner, sqlChecker);
  });

  /**
   * Generator for file extensions
   */
  const fileExtensionArb = fc.constantFrom(
    '.md', '.log', '.txt', '.json', '.html', '.csv', '.sql', 
    '.ts', '.tsx', '.js', '.jsx', '.py', '.png', '.jpg', ''
  );

  /**
   * Generator for file names
   */
  const fileNameArb = fc.oneof(
    // Essential files
    fc.constantFrom(
      'TESTING_GUIDE.md',
      'DESIGN_SYSTEM_GUIDE.md',
      'DEPLOYMENT.md',
      'AUTH_SETUP_GUIDE.md',
      'I18N_DEVELOPER_GUIDE.md',
      'package.json',
      'tsconfig.json',
      '.env.local',
      '.gitignore'
    ),
    // Temporary summaries
    fc.string({ minLength: 1, maxLength: 20 }).chain(prefix =>
      fc.constantFrom('_SUMMARY.md', '_REPORT.md', '_COMPLETE.md', '_STATUS.md', '_FIX_SUMMARY.md')
        .map(suffix => `${prefix}${suffix}`)
    ),
    fc.string({ minLength: 1, maxLength: 10 }).map(s => `TASK_${s}_SUMMARY.md`),
    fc.string({ minLength: 1, maxLength: 10 }).map(s => `CHECKPOINT_${s}_REPORT.md`),
    fc.string({ minLength: 1, maxLength: 10 }).map(s => `FINAL_${s}_SUMMARY.md`),
    // Translation work
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `BATCH2_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `I18N_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `WEEK4_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}_TRANSLATION_PLAN.md`),
    // Performance reports
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `DASHBOARD_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `BUNDLE_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `PERFORMANCE_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `OPTIMIZATION_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `LCP_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `LIGHTHOUSE_${s}.md`),
    // Temporary logs
    fc.constantFrom('test-results.json', 'test-output.log', 'chrome-scroll-test.html'),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.log`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `bundle-analysis-${s}.txt`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `lighthouse-${s}.json`),
    // SQL files
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.sql`),
    // Unknown files
    fc.string({ minLength: 1, maxLength: 20 }).chain(name =>
      fileExtensionArb.map(ext => `${name}${ext}`)
    )
  );

  /**
   * Generator for FileInfo objects
   */
  const fileInfoArb = fileNameArb.map(name => ({
    path: `/test/${name}`,
    name,
    extension: name.includes('.') ? name.substring(name.lastIndexOf('.')) : '',
    size: Math.floor(Math.random() * 10000),
    modifiedTime: new Date(),
  }));

  /**
   * Generator for arrays of FileInfo objects
   */
  const fileListArb = fc.array(fileInfoArb, { minLength: 1, maxLength: 50 });

  /**
   * Valid categories set
   */
  const validCategories = new Set(Object.values(FileCategory));

  // Feature: project-cleanup, Property 1: Categorization Completeness
  describe('Property 1: Categorization Completeness', () => {
    it('should assign every file to exactly one valid category', () => {
      fc.assert(
        fc.property(fileInfoArb, (file) => {
          const category = categorizer.categorizeFile(file);
          
          // Property: Every file must be assigned to exactly one category
          expect(category).toBeDefined();
          expect(typeof category).toBe('string');
          
          // Property: The category must be one of the valid categories
          expect(validCategories.has(category)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should categorize all files in a list without errors', () => {
      fc.assert(
        fc.property(fileListArb, (files) => {
          const categorized = categorizer.categorizeFiles(files);
          
          // Property: All files must be categorized
          const totalCategorized = Array.from(categorized.values())
            .reduce((sum, fileList) => sum + fileList.length, 0);
          
          expect(totalCategorized).toBe(files.length);
          
          // Property: Every category should exist in the map
          for (const category of Object.values(FileCategory)) {
            expect(categorized.has(category as FileCategory)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should never return null or undefined for any file', () => {
      fc.assert(
        fc.property(fileInfoArb, (file) => {
          const category = categorizer.categorizeFile(file);
          
          // Property: Category must never be null or undefined
          expect(category).not.toBeNull();
          expect(category).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should categorize the same file consistently', () => {
      fc.assert(
        fc.property(fileInfoArb, (file) => {
          const category1 = categorizer.categorizeFile(file);
          const category2 = categorizer.categorizeFile(file);
          
          // Property: Categorization must be deterministic
          expect(category1).toBe(category2);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: project-cleanup, Property 2: Priority-Based Categorization
  describe('Property 2: Priority-Based Categorization', () => {
    /**
     * Generator for files that match multiple patterns
     */
    const multiPatternFileArb = fc.oneof(
      // Files that match both TEMPORARY_SUMMARY and PERFORMANCE_REPORT patterns
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `MOBILE_${s}_IMPLEMENTATION_SUMMARY.md`),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `DASHBOARD_${s}_COMPLETION_SUMMARY.md`),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `PERFORMANCE_${s}_FIX_SUMMARY.md`),
      
      // Files that match both TRANSLATION_WORK and TEMPORARY_SUMMARY patterns
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `WEEK4_${s}_COMPLETE.md`),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `BATCH2_${s}_STATUS.md`),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `I18N_${s}_SUMMARY.md`),
    );

    it('should prioritize ESSENTIAL category over all other patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'TESTING_GUIDE.md',
            'DESIGN_SYSTEM_GUIDE.md',
            'DEPLOYMENT.md',
            'AUTH_SETUP_GUIDE.md',
            'I18N_DEVELOPER_GUIDE.md',
            'package.json',
            'tsconfig.json',
            '.env.local',
            '.gitignore'
          ),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: Essential files must always be categorized as ESSENTIAL
            expect(category).toBe(FileCategory.ESSENTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize TEMPORARY_SUMMARY over PERFORMANCE_REPORT for files matching both', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `MOBILE_${s}_IMPLEMENTATION_SUMMARY.md`),
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `DASHBOARD_${s}_COMPLETION_SUMMARY.md`),
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `PERFORMANCE_${s}_FIX_SUMMARY.md`),
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `STATE_${s}_SUMMARY.md`),
          ),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: '.md',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: TEMPORARY_SUMMARY (priority 80) should win over PERFORMANCE_REPORT (priority 60)
            expect(category).toBe(FileCategory.TEMPORARY_SUMMARY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize TEMPORARY_SUMMARY over TRANSLATION_WORK for files matching both', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `WEEK4_${s}_COMPLETE.md`),
            fc.string({ minLength: 1, maxLength: 10 }).map(s => `BATCH2_${s}_STATUS.md`),
          ),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: '.md',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: TEMPORARY_SUMMARY (priority 80) should win over TRANSLATION_WORK (priority 70)
            expect(category).toBe(FileCategory.TEMPORARY_SUMMARY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize SQL_REVIEW over other patterns for .sql files', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.sql`),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: '.sql',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: SQL files should always be categorized as SQL_REVIEW (priority 90)
            // unless they are essential files
            if (!scanner.isEssentialFile(fileName)) {
              expect(category).toBe(FileCategory.SQL_REVIEW);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect priority ordering for all category rules', () => {
      const rules = categorizer.getCategoryRules();
      
      // Property: Rules should be ordered by priority (descending)
      for (let i = 0; i < rules.length - 1; i++) {
        expect(rules[i].priority).toBeGreaterThanOrEqual(rules[i + 1].priority);
      }
    });

    it('should never categorize essential files as anything other than ESSENTIAL', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'TESTING_GUIDE.md',
            'DESIGN_SYSTEM_GUIDE.md',
            'DEPLOYMENT.md',
            'AUTH_SETUP_GUIDE.md',
            'I18N_DEVELOPER_GUIDE.md'
          ),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: '.md',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: Essential files must never be miscategorized
            expect(category).toBe(FileCategory.ESSENTIAL);
            expect(category).not.toBe(FileCategory.TEMPORARY_SUMMARY);
            expect(category).not.toBe(FileCategory.TRANSLATION_WORK);
            expect(category).not.toBe(FileCategory.PERFORMANCE_REPORT);
            expect(category).not.toBe(FileCategory.TEMPORARY_LOG);
            expect(category).not.toBe(FileCategory.SQL_REVIEW);
            expect(category).not.toBe(FileCategory.UNKNOWN);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle I18N_DEVELOPER_GUIDE.md specially (ESSENTIAL, not TRANSLATION_WORK)', () => {
      fc.assert(
        fc.property(
          fc.constant('I18N_DEVELOPER_GUIDE.md'),
          (fileName) => {
            const file: FileInfo = {
              path: `/test/${fileName}`,
              name: fileName,
              extension: '.md',
              size: 1024,
              modifiedTime: new Date(),
            };
            
            const category = categorizer.categorizeFile(file);
            
            // Property: I18N_DEVELOPER_GUIDE.md should be ESSENTIAL, not TRANSLATION_WORK
            // even though it matches the I18N_* pattern
            expect(category).toBe(FileCategory.ESSENTIAL);
            expect(category).not.toBe(FileCategory.TRANSLATION_WORK);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

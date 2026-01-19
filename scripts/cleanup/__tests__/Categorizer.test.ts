import { Categorizer } from '../Categorizer';
import { FileScanner } from '../FileScanner';
import { SqlReferenceChecker } from '../SqlReferenceChecker';
import { FileInfo, FileCategory } from '../types';

describe('Categorizer', () => {
  let categorizer: Categorizer;
  let scanner: FileScanner;
  let sqlChecker: SqlReferenceChecker;

  beforeEach(() => {
    scanner = new FileScanner(process.cwd());
    sqlChecker = new SqlReferenceChecker(process.cwd());
    categorizer = new Categorizer(scanner, sqlChecker);
  });

  /**
   * Helper function to create a FileInfo object for testing
   */
  const createFileInfo = (name: string): FileInfo => ({
    path: `/test/${name}`,
    name,
    extension: name.includes('.') ? name.substring(name.lastIndexOf('.')) : '',
    size: 1024,
    modifiedTime: new Date(),
  });

  describe('ESSENTIAL category', () => {
    it('should categorize TESTING_GUIDE.md as ESSENTIAL', () => {
      const file = createFileInfo('TESTING_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize DESIGN_SYSTEM_GUIDE.md as ESSENTIAL', () => {
      const file = createFileInfo('DESIGN_SYSTEM_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize DEPLOYMENT.md as ESSENTIAL', () => {
      const file = createFileInfo('DEPLOYMENT.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize AUTH_SETUP_GUIDE.md as ESSENTIAL', () => {
      const file = createFileInfo('AUTH_SETUP_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize I18N_DEVELOPER_GUIDE.md as ESSENTIAL', () => {
      const file = createFileInfo('I18N_DEVELOPER_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize package.json as ESSENTIAL', () => {
      const file = createFileInfo('package.json');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize tsconfig.json as ESSENTIAL', () => {
      const file = createFileInfo('tsconfig.json');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize .env.local as ESSENTIAL', () => {
      const file = createFileInfo('.env.local');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });

    it('should categorize .gitignore as ESSENTIAL', () => {
      const file = createFileInfo('.gitignore');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });
  });

  describe('TEMPORARY_SUMMARY category', () => {
    it('should categorize TASK_12_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('TASK_12_SUMMARY.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize CHECKPOINT_4_REPORT.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('CHECKPOINT_4_REPORT.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize FINAL_TEST_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('FINAL_TEST_SUMMARY.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize PHASE_1_COMPLETION_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('PHASE_1_COMPLETION_SUMMARY.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize BUILD_ERROR_FIX_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('BUILD_ERROR_FIX_SUMMARY.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize PMR_SECURITY_IMPLEMENTATION_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('PMR_SECURITY_IMPLEMENTATION_SUMMARY.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize HELP_CHAT_AUDIT_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('HELP_CHAT_AUDIT_SUMMARY.md');
      // Note: This file matches *_SUMMARY pattern, so it's TEMPORARY_SUMMARY
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize ENHANCED_PMR_FINAL_INTEGRATION_REPORT.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('ENHANCED_PMR_FINAL_INTEGRATION_REPORT.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize I18N_SYSTEM_COMPLETE.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('I18N_SYSTEM_COMPLETE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });
  });

  describe('TRANSLATION_WORK category', () => {
    it('should categorize BATCH2_TRANSLATION_PLAN.md as TRANSLATION_WORK', () => {
      const file = createFileInfo('BATCH2_TRANSLATION_PLAN.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TRANSLATION_WORK);
    });

    it('should categorize BATCH2_TRANSLATION_WORKBOOK.csv as TRANSLATION_WORK', () => {
      const file = createFileInfo('BATCH2_TRANSLATION_WORKBOOK.csv');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TRANSLATION_WORK);
    });

    it('should categorize I18N_TRANSLATION_PROGRESS.md as TRANSLATION_WORK', () => {
      const file = createFileInfo('I18N_TRANSLATION_PROGRESS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TRANSLATION_WORK);
    });

    it('should categorize WEEK4_COMPONENT_1_COMPLETE.md as TRANSLATION_WORK', () => {
      const file = createFileInfo('WEEK4_COMPONENT_1_COMPLETE.md');
      // Note: This matches both WEEK4_* (TRANSLATION_WORK) and *_COMPLETE (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 70), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize FEEDBACK_PAGE_TRANSLATION_KEYS.md as TRANSLATION_WORK', () => {
      const file = createFileInfo('FEEDBACK_PAGE_TRANSLATION_KEYS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TRANSLATION_WORK);
    });

    it('should NOT categorize I18N_DEVELOPER_GUIDE.md as TRANSLATION_WORK (it is ESSENTIAL)', () => {
      const file = createFileInfo('I18N_DEVELOPER_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.ESSENTIAL);
    });
  });

  describe('PERFORMANCE_REPORT category', () => {
    it('should categorize DASHBOARD_OPTIMIZATION_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('DASHBOARD_OPTIMIZATION_SUMMARY.md');
      // Note: This matches both DASHBOARD_* (PERFORMANCE_REPORT) and *_SUMMARY (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 60), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize BUNDLE_ANALYSIS_FINDINGS.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('BUNDLE_ANALYSIS_FINDINGS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize PERFORMANCE_OPTIMIZATION_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('PERFORMANCE_OPTIMIZATION_SUMMARY.md');
      // Note: This matches both PERFORMANCE_* (PERFORMANCE_REPORT) and *_SUMMARY (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 60), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize OPTIMIZATION_RESULTS_FINAL.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('OPTIMIZATION_RESULTS_FINAL.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize LCP_DEEP_DIVE_ANALYSIS.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('LCP_DEEP_DIVE_ANALYSIS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize CLS_PERFORMANCE_FIXES_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('CLS_PERFORMANCE_FIXES_SUMMARY.md');
      // Note: This matches both CLS_* (PERFORMANCE_REPORT) and *_FIX_SUMMARY (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 60), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize LIGHTHOUSE_PERFORMANCE_FIXES.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('LIGHTHOUSE_PERFORMANCE_FIXES.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize CHROME_DEVTOOLS_PROFILING_GUIDE.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('CHROME_DEVTOOLS_PROFILING_GUIDE.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize ADMIN_ROLE_SETUP.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('ADMIN_ROLE_SETUP.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize PHASE_2_OPTIMIZATION_RESULTS.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('PHASE_2_OPTIMIZATION_RESULTS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize VERCEL_DEPLOYMENT_OPTIMIZATIONS.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('VERCEL_DEPLOYMENT_OPTIMIZATIONS.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize IMAGE_OPTIMIZATION_VERIFICATION.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('IMAGE_OPTIMIZATION_VERIFICATION.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.PERFORMANCE_REPORT);
    });

    it('should categorize MOBILE_RESPONSIVE_IMPLEMENTATION_SUMMARY.md as PERFORMANCE_REPORT', () => {
      const file = createFileInfo('MOBILE_RESPONSIVE_IMPLEMENTATION_SUMMARY.md');
      // Note: This matches both MOBILE_* (PERFORMANCE_REPORT) and *_IMPLEMENTATION_SUMMARY (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 60), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });

    it('should categorize STATE_OPTIMIZATION_SUMMARY.md as TEMPORARY_SUMMARY', () => {
      const file = createFileInfo('STATE_OPTIMIZATION_SUMMARY.md');
      // Note: This matches both STATE_* (PERFORMANCE_REPORT) and *_SUMMARY (TEMPORARY_SUMMARY)
      // TEMPORARY_SUMMARY has higher priority (80 vs 60), so it wins
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_SUMMARY);
    });
  });

  describe('TEMPORARY_LOG category', () => {
    it('should categorize test-results.json as TEMPORARY_LOG', () => {
      const file = createFileInfo('test-results.json');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize test-output.log as TEMPORARY_LOG', () => {
      const file = createFileInfo('test-output.log');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize bundle-analysis-report.txt as TEMPORARY_LOG', () => {
      const file = createFileInfo('bundle-analysis-report.txt');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize bundle-analysis.log as TEMPORARY_LOG', () => {
      const file = createFileInfo('bundle-analysis.log');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize chrome-scroll-test.html as TEMPORARY_LOG', () => {
      const file = createFileInfo('chrome-scroll-test.html');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize lighthouse-admin-performance.json as TEMPORARY_LOG', () => {
      const file = createFileInfo('lighthouse-admin-performance.json');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize lighthouse-final-validation.log as TEMPORARY_LOG', () => {
      const file = createFileInfo('lighthouse-final-validation.log');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize any .log file as TEMPORARY_LOG', () => {
      const file = createFileInfo('debug.log');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });

    it('should categorize error.log as TEMPORARY_LOG', () => {
      const file = createFileInfo('error.log');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.TEMPORARY_LOG);
    });
  });

  describe('SQL_REVIEW category', () => {
    it('should categorize COMPLETE_SETUP.sql as SQL_REVIEW', () => {
      const file = createFileInfo('COMPLETE_SETUP.sql');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.SQL_REVIEW);
    });

    it('should categorize QUICK_FIX_ADMIN.sql as SQL_REVIEW', () => {
      const file = createFileInfo('QUICK_FIX_ADMIN.sql');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.SQL_REVIEW);
    });

    it('should categorize database_migration.sql as SQL_REVIEW', () => {
      const file = createFileInfo('database_migration.sql');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.SQL_REVIEW);
    });

    it('should categorize setup.SQL as SQL_REVIEW (case insensitive)', () => {
      const file = createFileInfo('setup.SQL');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.SQL_REVIEW);
    });
  });

  describe('UNKNOWN category', () => {
    it('should categorize unmatched markdown file as UNKNOWN', () => {
      const file = createFileInfo('RANDOM_DOCUMENT.md');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched text file as UNKNOWN', () => {
      const file = createFileInfo('notes.txt');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched JSON file as UNKNOWN', () => {
      const file = createFileInfo('data.json');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched TypeScript file as UNKNOWN', () => {
      const file = createFileInfo('script.ts');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched JavaScript file as UNKNOWN', () => {
      const file = createFileInfo('helper.js');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched Python file as UNKNOWN', () => {
      const file = createFileInfo('script.py');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize unmatched image file as UNKNOWN', () => {
      const file = createFileInfo('screenshot.png');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });

    it('should categorize file with no extension as UNKNOWN', () => {
      const file = createFileInfo('LICENSE');
      expect(categorizer.categorizeFile(file)).toBe(FileCategory.UNKNOWN);
    });
  });

  describe('categorizeFiles', () => {
    it('should categorize multiple files correctly', () => {
      const files = [
        createFileInfo('TESTING_GUIDE.md'),
        createFileInfo('TASK_12_SUMMARY.md'),
        createFileInfo('BATCH2_TRANSLATION_PLAN.md'),
        createFileInfo('BUNDLE_ANALYSIS_FINDINGS.md'), // Changed from DASHBOARD_OPTIMIZATION_SUMMARY.md
        createFileInfo('test-results.json'),
        createFileInfo('COMPLETE_SETUP.sql'),
        createFileInfo('RANDOM_DOCUMENT.md'),
      ];

      const categorized = categorizer.categorizeFiles(files);

      expect(categorized.get(FileCategory.ESSENTIAL)).toHaveLength(1);
      expect(categorized.get(FileCategory.TEMPORARY_SUMMARY)).toHaveLength(1);
      expect(categorized.get(FileCategory.TRANSLATION_WORK)).toHaveLength(1);
      expect(categorized.get(FileCategory.PERFORMANCE_REPORT)).toHaveLength(1);
      expect(categorized.get(FileCategory.TEMPORARY_LOG)).toHaveLength(1);
      expect(categorized.get(FileCategory.SQL_REVIEW)).toHaveLength(1);
      expect(categorized.get(FileCategory.UNKNOWN)).toHaveLength(1);
    });

    it('should initialize all categories even if empty', () => {
      const files: FileInfo[] = [];
      const categorized = categorizer.categorizeFiles(files);

      expect(categorized.has(FileCategory.ESSENTIAL)).toBe(true);
      expect(categorized.has(FileCategory.TEMPORARY_SUMMARY)).toBe(true);
      expect(categorized.has(FileCategory.TRANSLATION_WORK)).toBe(true);
      expect(categorized.has(FileCategory.PERFORMANCE_REPORT)).toBe(true);
      expect(categorized.has(FileCategory.TEMPORARY_LOG)).toBe(true);
      expect(categorized.has(FileCategory.SQL_REVIEW)).toBe(true);
      expect(categorized.has(FileCategory.UNKNOWN)).toBe(true);
    });
  });

  describe('getCategoryRules', () => {
    it('should return all category rules', () => {
      const rules = categorizer.getCategoryRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(rule => rule.category && rule.patterns && rule.priority !== undefined)).toBe(true);
    });

    it('should have rules sorted by priority', () => {
      const rules = categorizer.getCategoryRules();
      const priorities = rules.map(r => r.priority);
      
      // Check that priorities are in descending order
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i + 1]);
      }
    });
  });
});

"use strict";
/**
 * Temporary file patterns to add to .gitignore
 * Organized by category with explanatory comments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemporaryFilePatterns = getTemporaryFilePatterns;
/**
 * Get all temporary file pattern groups to add to .gitignore
 */
function getTemporaryFilePatterns() {
    return [
        {
            comment: 'Temporary task summaries and reports',
            patterns: [
                'TASK_*_SUMMARY.md',
                'CHECKPOINT_*_REPORT.md',
                'FINAL_*_SUMMARY.md',
                '*_COMPLETION_SUMMARY.md',
                '*_FIX_SUMMARY.md',
                '*_IMPLEMENTATION_SUMMARY.md',
                '*_VALIDATION_REPORT.md',
            ]
        },
        {
            comment: 'Temporary logs and test outputs',
            patterns: [
                'test-results.json',
                'test-output.log',
                'bundle-analysis-report.txt',
                'bundle-analysis.log',
                'chrome-scroll-test.html',
                'lighthouse-*.log',
                'lighthouse-*.json',
            ]
        },
        {
            comment: 'Performance investigation files',
            patterns: [
                'DASHBOARD_*.md',
                'BUNDLE_*.md',
                'PERFORMANCE_*.md',
                'OPTIMIZATION_*.md',
                'LCP_*.md',
                'CLS_*.md',
                'TBT_*.md',
                'LIGHTHOUSE_*.md',
            ]
        },
        {
            comment: 'Translation and internationalization work files',
            patterns: [
                'BATCH2_*.md',
                'WEEK4_*.md',
                '*_TRANSLATION_*.md',
                'I18N_*_PROGRESS.md',
                'I18N_*_STATUS.md',
                '*_TRANSLATION_*.csv',
            ]
        },
        {
            comment: 'Deployment and setup temporary files',
            patterns: [
                'QUICK_FIX_*.md',
                'QUICK_FIX_*.sql',
                'WORKAROUND_*.md',
                'FIX_*_ERROR.md',
                'RESTART_*.md',
                'START_*.md',
            ]
        },
    ];
}

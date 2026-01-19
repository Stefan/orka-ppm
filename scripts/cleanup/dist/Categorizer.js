"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Categorizer = void 0;
const types_1 = require("./types");
/**
 * Categorizes files based on pattern matching rules
 */
class Categorizer {
    constructor(scanner, sqlChecker) {
        this.scanner = scanner;
        this.sqlChecker = sqlChecker;
        this.rules = this.initializeRules();
    }
    /**
     * Initialize category rules with patterns and priorities
     * Higher priority = checked first
     */
    initializeRules() {
        return [
            // Priority 100: Essential files (checked first)
            {
                category: types_1.FileCategory.ESSENTIAL,
                patterns: [], // Handled by whitelist check
                priority: 100,
            },
            // Priority 90: SQL files for review
            {
                category: types_1.FileCategory.SQL_REVIEW,
                patterns: [/\.sql$/i],
                priority: 90,
            },
            // Priority 80: Specific temporary summaries
            {
                category: types_1.FileCategory.TEMPORARY_SUMMARY,
                patterns: [
                    /^TASK_.*_SUMMARY\.md$/i,
                    /^CHECKPOINT_.*_REPORT\.md$/i,
                    /^FINAL_.*_SUMMARY\.md$/i,
                    /.*_COMPLETION_SUMMARY\.md$/i,
                    /.*_FIX_SUMMARY\.md$/i,
                    /.*_IMPLEMENTATION_SUMMARY\.md$/i,
                    /.*_INTEGRATION_SUMMARY\.md$/i,
                    /.*_VALIDATION_SUMMARY\.md$/i,
                    /.*_STATUS\.md$/i,
                    /.*_COMPLETE\.md$/i,
                    /.*_REPORT\.md$/i,
                    /.*_SUMMARY\.md$/i, // General summary pattern
                    // Temporary development/troubleshooting notes
                    /^RESTART_DEV_SERVER\.md$/i,
                    /^START_BACKEND\.md$/i,
                    /^WORKAROUND_APPLIED\.md$/i,
                    /^QUICK_FIX_.*\.md$/i,
                    /^FIX_.*_ERROR\.md$/i,
                    /^NEXT_STEPS_.*\.md$/i,
                    /^REAL_.*_MONITORING\.md$/i,
                    /^COMPLETE_.*\.md$/i,
                    /^OPTION\d+_.*\.md$/i,
                    /^CHUNK_\d+_.*\.md$/i,
                ],
                priority: 80,
            },
            // Priority 70: Translation work files
            {
                category: types_1.FileCategory.TRANSLATION_WORK,
                patterns: [
                    /^BATCH2_.*\.md$/i,
                    /^I18N_(?!DEVELOPER_GUIDE).*\.md$/i, // I18N files except DEVELOPER_GUIDE
                    /^WEEK4_.*\.md$/i,
                    /.*_TRANSLATION_.*\.md$/i,
                    /.*_TRANSLATION_.*\.csv$/i,
                ],
                priority: 70,
            },
            // Priority 65: Outdated setup/deployment guides
            {
                category: types_1.FileCategory.PERFORMANCE_REPORT, // Archive with other docs
                patterns: [
                    /^AUTH_SETUP_GUIDE\.md$/i,
                    /^DEPLOYMENT\.md$/i, // Basic deployment config (superseded by docs/DEPLOYMENT_PROCEDURES.md)
                ],
                priority: 65,
            },
            // Priority 60: Performance reports
            {
                category: types_1.FileCategory.PERFORMANCE_REPORT,
                patterns: [
                    /^DASHBOARD_.*\.md$/i,
                    /^BUNDLE_.*\.md$/i,
                    /^PERFORMANCE_.*\.md$/i,
                    /^OPTIMIZATION_.*\.md$/i,
                    /^LCP_.*\.md$/i,
                    /^CLS_.*\.md$/i,
                    /^TBT_.*\.md$/i,
                    /^LIGHTHOUSE_.*\.md$/i,
                    /^CHROME_.*\.md$/i,
                    /^ADMIN_.*\.md$/i,
                    /^PHASE_.*\.md$/i,
                    /^CODEBASE_.*\.md$/i,
                    /^DEPENDENCY_.*\.md$/i,
                    /^DEPLOYMENT_.*\.md$/i,
                    /^VERCEL_.*\.md$/i,
                    /^IMAGE_.*\.md$/i,
                    /^MOBILE_.*\.md$/i,
                    /^STATE_.*\.md$/i,
                    /^WEB_.*\.md$/i,
                    /^TIPTAP_.*\.md$/i,
                    /^ROUTE_.*\.md$/i,
                    /^VIRTUAL_.*\.md$/i,
                    /^DYNAMIC_.*\.md$/i,
                    /.*_DEPLOYMENT_CHECKLIST\.md$/i, // Feature-specific deployment checklists
                ],
                priority: 60,
            },
            // Priority 50: Temporary logs and test outputs
            {
                category: types_1.FileCategory.TEMPORARY_LOG,
                patterns: [
                    /\.log$/i,
                    /^test-results\.json$/i,
                    /^test-output\.log$/i,
                    /^bundle-analysis.*\.(txt|log|md)$/i,
                    /^chrome-scroll.*\.(html|md)$/i,
                    /^lighthouse-.*\.(json|log)$/i,
                    /\.tsbuildinfo$/i, // TypeScript build cache
                    /^test-.*\.css$/i, // Test CSS files
                    /^DASHBOARD_.*\.json$/i, // Performance profiling data
                    /^\d+$/i, // Files with only numbers (like "0")
                ],
                priority: 50,
            },
        ];
    }
    /**
     * Categorize a file based on rules
     */
    categorizeFile(file) {
        // Check essential files first (highest priority)
        if (this.scanner.isEssentialFile(file.name)) {
            return types_1.FileCategory.ESSENTIAL;
        }
        // Check SQL files for references in documentation
        if (file.extension.toLowerCase() === '.sql') {
            if (this.sqlChecker.isReferencedInDocs(file.name)) {
                // SQL file is referenced in essential docs, treat as ESSENTIAL
                return types_1.FileCategory.ESSENTIAL;
            }
            else {
                // SQL file is not referenced, categorize as SQL_REVIEW for archiving
                return types_1.FileCategory.SQL_REVIEW;
            }
        }
        // Find all matching rules and their priorities
        const matches = [];
        for (const rule of this.rules) {
            if (rule.category === types_1.FileCategory.ESSENTIAL) {
                continue; // Already checked above
            }
            for (const pattern of rule.patterns) {
                if (pattern.test(file.name)) {
                    matches.push({ category: rule.category, priority: rule.priority });
                    break; // Only need one match per rule
                }
            }
        }
        // If no matches found, return UNKNOWN
        if (matches.length === 0) {
            return types_1.FileCategory.UNKNOWN;
        }
        // Return the category with the highest priority
        matches.sort((a, b) => b.priority - a.priority);
        return matches[0].category;
    }
    /**
     * Get all category rules
     */
    getCategoryRules() {
        return this.rules;
    }
    /**
     * Categorize multiple files
     */
    categorizeFiles(files) {
        const categorized = new Map();
        // Initialize all categories
        for (const category of Object.values(types_1.FileCategory)) {
            categorized.set(category, []);
        }
        // Categorize each file
        for (const file of files) {
            const category = this.categorizeFile(file);
            categorized.get(category).push(file);
        }
        return categorized;
    }
}
exports.Categorizer = Categorizer;

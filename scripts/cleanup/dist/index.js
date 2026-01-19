#!/usr/bin/env node
"use strict";
/**
 * Project Cleanup CLI Tool
 *
 * Scans, categorizes, archives, and deletes files in the project root directory.
 *
 * Usage:
 *   node scripts/cleanup/index.js [options]
 *   npm run cleanup [-- options]
 *
 * Options:
 *   --dry-run    Preview actions without executing them
 *   --verbose    Enable detailed logging
 *   --help       Show this help message
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const FileScanner_1 = require("./FileScanner");
const Categorizer_1 = require("./Categorizer");
const ArchiveManager_1 = require("./ArchiveManager");
const Deleter_1 = require("./Deleter");
const ReportGenerator_1 = require("./ReportGenerator");
const GitignoreUpdater_1 = require("./GitignoreUpdater");
const SqlReferenceChecker_1 = require("./SqlReferenceChecker");
const types_1 = require("./types");
/**
 * Parse command-line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        verbose: args.includes('--verbose'),
        help: args.includes('--help'),
    };
}
/**
 * Display help message
 */
function showHelp() {
    console.log(`
Project Cleanup CLI Tool

Scans, categorizes, archives, and deletes files in the project root directory.

Usage:
  node scripts/cleanup/index.js [options]
  npm run cleanup [-- options]

Options:
  --dry-run    Preview actions without executing them
  --verbose    Enable detailed logging
  --help       Show this help message

Examples:
  npm run cleanup -- --dry-run     # Preview cleanup actions
  npm run cleanup -- --verbose     # Run with detailed logging
  npm run cleanup                  # Execute cleanup

Safety Features:
  - Essential files are never deleted or archived
  - Backup list created before any deletions
  - Archive preserves file timestamps
  - Comprehensive summary report generated
  - .gitignore updated to prevent future accumulation
`);
}
/**
 * Log message (respects verbose flag)
 */
function log(message, verbose, force = false) {
    if (force || verbose) {
        console.log(message);
    }
}
/**
 * Main cleanup orchestrator
 */
async function main() {
    const options = parseArgs();
    // Show help if requested
    if (options.help) {
        showHelp();
        process.exit(0);
    }
    const rootDir = process.cwd();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('='.repeat(60));
    console.log('Project Cleanup Tool');
    console.log('='.repeat(60));
    console.log();
    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified');
        console.log();
    }
    try {
        // Phase 1: Scan and Categorize
        console.log('Phase 1: Scanning and Categorizing Files');
        console.log('-'.repeat(60));
        log('Initializing components...', options.verbose);
        const scanner = new FileScanner_1.FileScanner(rootDir);
        const sqlChecker = new SqlReferenceChecker_1.SqlReferenceChecker(rootDir);
        const categorizer = new Categorizer_1.Categorizer(scanner, sqlChecker);
        log('Scanning root directory...', options.verbose);
        const allFiles = scanner.scanRootDirectory();
        console.log(`✓ Found ${allFiles.length} files in root directory`);
        log('Categorizing files...', options.verbose);
        const categorized = categorizer.categorizeFiles(allFiles);
        // Display categorization summary
        console.log();
        console.log('Categorization Summary:');
        for (const [category, files] of categorized.entries()) {
            if (files.length > 0) {
                console.log(`  - ${category}: ${files.length} files`);
                if (options.verbose) {
                    files.forEach(f => console.log(`    • ${f.name}`));
                }
            }
        }
        console.log();
        // Phase 2: Archive and Delete
        console.log('Phase 2: Archiving and Deleting Files');
        console.log('-'.repeat(60));
        const archiveManager = new ArchiveManager_1.ArchiveManager();
        const deleter = new Deleter_1.Deleter();
        const allArchiveResults = [];
        const allDeletionResults = [];
        // Create archive structure
        if (!options.dryRun) {
            log('Creating archive structure...', options.verbose);
            archiveManager.createArchiveStructure({
                archiveRoot: path.join(rootDir, '.kiro', 'archive'),
                timestamp,
            });
            console.log(`✓ Archive created at: ${archiveManager.getArchiveDir()}`);
        }
        else {
            console.log(`📁 Would create archive at: ${path.join(rootDir, '.kiro', 'archive', `${timestamp}_cleanup`)}`);
        }
        // Archive files
        const categoriesToArchive = [
            types_1.FileCategory.TRANSLATION_WORK,
            types_1.FileCategory.PERFORMANCE_REPORT,
            types_1.FileCategory.SQL_REVIEW,
        ];
        let archivedCount = 0;
        for (const category of categoriesToArchive) {
            const files = categorized.get(category) || [];
            if (files.length > 0) {
                log(`Archiving ${files.length} ${category} files...`, options.verbose);
                for (const file of files) {
                    if (!options.dryRun) {
                        const result = archiveManager.archiveFile(file, category);
                        allArchiveResults.push(result);
                        if (result.success) {
                            archivedCount++;
                            log(`  ✓ Archived: ${file.name}`, options.verbose);
                        }
                        else {
                            log(`  ✗ Failed to archive: ${file.name} - ${result.error}`, options.verbose, true);
                        }
                    }
                    else {
                        console.log(`  📦 Would archive: ${file.name}`);
                        archivedCount++;
                    }
                }
            }
        }
        console.log(`✓ Archived ${archivedCount} files`);
        console.log();
        // Delete temporary files
        const categoriesToDelete = [
            types_1.FileCategory.TEMPORARY_SUMMARY,
            types_1.FileCategory.TEMPORARY_LOG,
        ];
        const filesToDelete = [];
        for (const category of categoriesToDelete) {
            const files = categorized.get(category) || [];
            filesToDelete.push(...files);
        }
        if (filesToDelete.length > 0) {
            if (!options.dryRun) {
                log('Creating deletion backup...', options.verbose);
                deleter.createDeletionBackup(filesToDelete);
                console.log(`✓ Backup created at: .kiro/cleanup-backup.json`);
            }
            else {
                console.log(`💾 Would create backup at: .kiro/cleanup-backup.json`);
            }
            log(`Deleting ${filesToDelete.length} temporary files...`, options.verbose);
            let deletedCount = 0;
            for (const file of filesToDelete) {
                const category = categorizer.categorizeFile(file);
                if (!options.dryRun) {
                    const result = deleter.deleteFile(file, category);
                    allDeletionResults.push(result);
                    if (result.success) {
                        deletedCount++;
                        log(`  ✓ Deleted: ${file.name}`, options.verbose);
                    }
                    else {
                        log(`  ✗ Failed to delete: ${file.name} - ${result.error}`, options.verbose, true);
                    }
                }
                else {
                    console.log(`  🗑️  Would delete: ${file.name}`);
                    deletedCount++;
                }
            }
            console.log(`✓ Deleted ${deletedCount} files`);
        }
        else {
            console.log('✓ No temporary files to delete');
        }
        console.log();
        // Flag unknown files
        const unknownFiles = categorized.get(types_1.FileCategory.UNKNOWN) || [];
        if (unknownFiles.length > 0) {
            log('Flagging unknown files for manual review...', options.verbose);
            unknownFiles.forEach(file => deleter.flagUnknownFile(file));
            console.log(`⚠️  ${unknownFiles.length} unknown files flagged for manual review`);
            console.log();
        }
        // Phase 3: Generate Report and Update .gitignore
        console.log('Phase 3: Generating Report and Updating .gitignore');
        console.log('-'.repeat(60));
        // Calculate statistics
        const preservedFiles = categorized.get(types_1.FileCategory.ESSENTIAL) || [];
        const totalSizeReduced = [...filesToDelete, ...allArchiveResults.map(r => {
                const file = allFiles.find(f => f.path === r.originalPath);
                return file;
            }).filter(f => f !== undefined)].reduce((sum, file) => sum + (file?.size || 0), 0);
        const stats = {
            totalFiles: allFiles.length,
            filesDeleted: options.dryRun ? filesToDelete.length : allDeletionResults.filter(r => r.success).length,
            filesArchived: archivedCount,
            filesPreserved: preservedFiles.length,
            sizeReduced: totalSizeReduced,
            archiveLocation: archiveManager.getArchiveDir() || path.join(rootDir, '.kiro', 'archive', `${timestamp}_cleanup`),
        };
        // Generate report
        const reportGenerator = new ReportGenerator_1.ReportGenerator();
        const deletedByCategory = new Map();
        const archivedByCategory = new Map();
        for (const category of categoriesToDelete) {
            deletedByCategory.set(category, categorized.get(category) || []);
        }
        for (const category of categoriesToArchive) {
            const results = allArchiveResults.filter(r => {
                const file = allFiles.find(f => f.path === r.originalPath);
                return file && categorizer.categorizeFile(file) === category;
            });
            archivedByCategory.set(category, results);
        }
        const reportContent = reportGenerator.generateSummary(stats, deletedByCategory, archivedByCategory, preservedFiles, unknownFiles);
        if (!options.dryRun) {
            const reportPath = path.join(rootDir, 'CLEANUP_SUMMARY.md');
            reportGenerator.writeReport(reportContent, reportPath);
            console.log(`✓ Report generated: CLEANUP_SUMMARY.md`);
        }
        else {
            console.log('📄 Would generate report: CLEANUP_SUMMARY.md');
            if (options.verbose) {
                console.log();
                console.log('Report Preview:');
                console.log('-'.repeat(60));
                console.log(reportContent);
                console.log('-'.repeat(60));
            }
        }
        // Generate archive index
        if (!options.dryRun && allArchiveResults.length > 0) {
            log('Generating archive index...', options.verbose);
            archiveManager.generateArchiveIndex(allArchiveResults);
            console.log(`✓ Archive index created`);
        }
        // Update .gitignore
        log('Updating .gitignore...', options.verbose);
        const gitignoreUpdater = new GitignoreUpdater_1.GitignoreUpdater(rootDir);
        gitignoreUpdater.readGitignore();
        // Add patterns for temporary files
        gitignoreUpdater.addPatterns([
            'TASK_*_SUMMARY.md',
            'CHECKPOINT_*_REPORT.md',
            'FINAL_*_SUMMARY.md',
            '*_COMPLETION_SUMMARY.md',
            '*_FIX_SUMMARY.md',
            '*_IMPLEMENTATION_SUMMARY.md',
            '*_INTEGRATION_SUMMARY.md',
            '*_VALIDATION_SUMMARY.md',
            '*_STATUS.md',
            '*_COMPLETE.md',
            '*_REPORT.md',
            // Development/troubleshooting notes
            'RESTART_*.md',
            'START_*.md',
            'WORKAROUND_*.md',
            'QUICK_FIX_*.md',
            'FIX_*_ERROR.md',
            'NEXT_STEPS_*.md',
            'REAL_*_MONITORING.md',
            'COMPLETE_*.md',
            'OPTION*_*.md',
            'CHUNK_*_*.md',
        ], 'Temporary task summaries and reports');
        gitignoreUpdater.addPatterns([
            '*.log',
            'test-results.json',
            'test-output.log',
            'bundle-analysis-report.txt',
            'bundle-analysis-*.md',
            'chrome-scroll-*.html',
            'chrome-scroll-*.md',
            'lighthouse-*.json',
            'lighthouse-*.log',
            '*.tsbuildinfo',
            'test-*.css',
            'DASHBOARD_*.json',
        ], 'Temporary logs and test outputs');
        gitignoreUpdater.addPatterns([
            'DASHBOARD_*.md',
            'BUNDLE_*.md',
            'PERFORMANCE_*.md',
            'OPTIMIZATION_*.md',
            'LCP_*.md',
            'CLS_*.md',
            'TBT_*.md',
            'LIGHTHOUSE_*.md',
            'CHROME_*.md',
            'ADMIN_*.md',
            'PHASE_*.md',
        ], 'Performance investigation files');
        gitignoreUpdater.addPatterns([
            'BATCH2_*.md',
            'WEEK4_*.md',
            '*_TRANSLATION_*.md',
            '*_TRANSLATION_*.csv',
        ], 'Translation work files');
        gitignoreUpdater.addPatterns([
            'CLEANUP_SUMMARY.md',
        ], 'Cleanup summary report');
        if (!options.dryRun) {
            if (gitignoreUpdater.validateSyntax()) {
                gitignoreUpdater.writeGitignore();
                console.log(`✓ .gitignore updated with temporary file patterns`);
            }
            else {
                console.log(`⚠️  .gitignore syntax validation failed - skipping update`);
            }
        }
        else {
            console.log('📝 Would update .gitignore with temporary file patterns');
        }
        console.log();
        console.log('='.repeat(60));
        console.log('Cleanup Complete!');
        console.log('='.repeat(60));
        console.log();
        console.log('Summary:');
        console.log(`  • Total files processed: ${stats.totalFiles}`);
        console.log(`  • Files deleted: ${stats.filesDeleted}`);
        console.log(`  • Files archived: ${stats.filesArchived}`);
        console.log(`  • Files preserved: ${stats.filesPreserved}`);
        console.log(`  • Size reduced: ${formatBytes(stats.sizeReduced)}`);
        if (unknownFiles.length > 0) {
            console.log();
            console.log(`⚠️  ${unknownFiles.length} unknown files require manual review`);
            console.log('   See CLEANUP_SUMMARY.md for details');
        }
        if (options.dryRun) {
            console.log();
            console.log('🔍 This was a dry run - no files were modified');
            console.log('   Run without --dry-run to execute the cleanup');
        }
        console.log();
        process.exit(0);
    }
    catch (error) {
        console.error();
        console.error('❌ Cleanup failed with error:');
        console.error(error instanceof Error ? error.message : String(error));
        if (options.verbose && error instanceof Error && error.stack) {
            console.error();
            console.error('Stack trace:');
            console.error(error.stack);
        }
        console.error();
        console.error('The cleanup was aborted. No further changes will be made.');
        process.exit(1);
    }
}
/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
// Run the main function
main();

"use strict";
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
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
/**
 * Generates comprehensive cleanup summary reports
 */
class ReportGenerator {
    /**
     * Generate a markdown summary report
     */
    generateSummary(stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) {
        const sections = [];
        // Title
        sections.push('# Project Cleanup Summary Report');
        sections.push('');
        sections.push(`Generated: ${new Date().toISOString()}`);
        sections.push('');
        // Executive Summary
        sections.push('## Executive Summary');
        sections.push('');
        sections.push(`- **Total Files Processed**: ${stats.totalFiles}`);
        sections.push(`- **Files Deleted**: ${stats.filesDeleted}`);
        sections.push(`- **Files Archived**: ${stats.filesArchived}`);
        sections.push(`- **Files Preserved**: ${stats.filesPreserved}`);
        sections.push(`- **Size Reduced**: ${this.formatBytes(stats.sizeReduced)}`);
        sections.push(`- **Archive Location**: \`${stats.archiveLocation}\``);
        sections.push('');
        // Before/After Comparison
        const beforeCount = stats.totalFiles;
        const afterCount = stats.filesPreserved + unknownFiles.length;
        const reduction = beforeCount - afterCount;
        const reductionPercent = beforeCount > 0 ? ((reduction / beforeCount) * 100).toFixed(1) : '0.0';
        sections.push('## Before/After Comparison');
        sections.push('');
        sections.push(`- **Before Cleanup**: ${beforeCount} files`);
        sections.push(`- **After Cleanup**: ${afterCount} files`);
        sections.push(`- **Files Removed**: ${reduction} files (${reductionPercent}% reduction)`);
        sections.push('');
        // Deleted Files by Category
        sections.push('## Deleted Files');
        sections.push('');
        const deletedCategories = Array.from(deletedFiles.entries())
            .filter(([_, files]) => files.length > 0)
            .sort((a, b) => b[1].length - a[1].length);
        if (deletedCategories.length === 0) {
            sections.push('No files were deleted.');
            sections.push('');
        }
        else {
            for (const [category, files] of deletedCategories) {
                sections.push(`### ${this.formatCategoryName(category)} (${files.length} files)`);
                sections.push('');
                for (const file of files) {
                    sections.push(`- \`${file.name}\` (${this.formatBytes(file.size)})`);
                }
                sections.push('');
            }
        }
        // Archived Files with New Locations
        sections.push('## Archived Files');
        sections.push('');
        const archivedCategories = Array.from(archivedFiles.entries())
            .filter(([_, results]) => results.length > 0)
            .sort((a, b) => b[1].length - a[1].length);
        if (archivedCategories.length === 0) {
            sections.push('No files were archived.');
            sections.push('');
        }
        else {
            for (const [category, results] of archivedCategories) {
                sections.push(`### ${this.formatCategoryName(category)} (${results.length} files)`);
                sections.push('');
                // Special handling for SQL files
                if (category === types_1.FileCategory.SQL_REVIEW) {
                    sections.push('**Note**: These SQL files have been archived for manual review. They were not referenced in essential documentation (DEPLOYMENT.md, AUTH_SETUP_GUIDE.md) and may be outdated or no longer needed.');
                    sections.push('');
                }
                for (const result of results) {
                    const originalName = path.basename(result.originalPath);
                    const archivePath = result.archivePath.replace(process.cwd(), '.');
                    sections.push(`- \`${originalName}\``);
                    sections.push(`  - **New Location**: \`${archivePath}\``);
                    // Add manual review status for SQL files
                    if (category === types_1.FileCategory.SQL_REVIEW) {
                        sections.push(`  - **Status**: Manual review required`);
                    }
                }
                sections.push('');
            }
        }
        // Preserved Essential Files
        sections.push('## Preserved Essential Files');
        sections.push('');
        if (preservedFiles.length === 0) {
            sections.push('No essential files were identified.');
            sections.push('');
        }
        else {
            sections.push(`${preservedFiles.length} essential files were preserved in their original locations:`);
            sections.push('');
            for (const file of preservedFiles.sort((a, b) => a.name.localeCompare(b.name))) {
                sections.push(`- \`${file.name}\``);
            }
            sections.push('');
        }
        // Unknown Files (flagged for manual review)
        if (unknownFiles.length > 0) {
            sections.push('## Unknown Files (Manual Review Required)');
            sections.push('');
            sections.push(`${unknownFiles.length} files did not match any known pattern and were left unchanged:`);
            sections.push('');
            for (const file of unknownFiles.sort((a, b) => a.name.localeCompare(b.name))) {
                sections.push(`- \`${file.name}\` (${this.formatBytes(file.size)})`);
            }
            sections.push('');
            sections.push('**Recommendation**: Review these files manually to determine if they should be kept, archived, or deleted.');
            sections.push('');
        }
        return sections.join('\n');
    }
    /**
     * Write the report to a file
     */
    writeReport(content, outputPath) {
        try {
            fs.writeFileSync(outputPath, content, 'utf-8');
        }
        catch (error) {
            console.error(`Error writing report to ${outputPath}:`, error);
            throw error;
        }
    }
    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
    /**
     * Format category name for display
     */
    formatCategoryName(category) {
        const names = {
            [types_1.FileCategory.TEMPORARY_SUMMARY]: 'Temporary Summaries',
            [types_1.FileCategory.TRANSLATION_WORK]: 'Translation Work',
            [types_1.FileCategory.PERFORMANCE_REPORT]: 'Performance Reports',
            [types_1.FileCategory.TEMPORARY_LOG]: 'Temporary Logs',
            [types_1.FileCategory.ESSENTIAL]: 'Essential Files',
            [types_1.FileCategory.SQL_REVIEW]: 'SQL Files',
            [types_1.FileCategory.UNKNOWN]: 'Unknown Files',
        };
        return names[category] || category;
    }
}
exports.ReportGenerator = ReportGenerator;

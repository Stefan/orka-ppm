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
exports.ArchiveManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
/**
 * Manages archiving of files into organized directory structure
 */
class ArchiveManager {
    constructor() {
        this.config = null;
        this.archiveDir = null;
    }
    /**
     * Create archive directory structure with timestamped folder
     * and subdirectories for each category
     */
    createArchiveStructure(config) {
        this.config = config;
        // Create the timestamped archive directory
        this.archiveDir = path.join(config.archiveRoot, `${config.timestamp}_cleanup`);
        // Handle conflicts if directory already exists
        let counter = 1;
        let finalArchiveDir = this.archiveDir;
        while (fs.existsSync(finalArchiveDir)) {
            counter++;
            finalArchiveDir = path.join(config.archiveRoot, `${config.timestamp}_cleanup_${counter}`);
        }
        this.archiveDir = finalArchiveDir;
        // Create the main archive directory
        fs.mkdirSync(this.archiveDir, { recursive: true });
        // Create subdirectories for each category
        const categories = [
            { category: types_1.FileCategory.TRANSLATION_WORK, dirname: 'translation-work' },
            { category: types_1.FileCategory.PERFORMANCE_REPORT, dirname: 'performance-reports' },
            { category: types_1.FileCategory.TEMPORARY_SUMMARY, dirname: 'temporary-summaries' },
            { category: types_1.FileCategory.SQL_REVIEW, dirname: 'sql-files' },
            { category: types_1.FileCategory.UNKNOWN, dirname: 'unknown' },
        ];
        for (const { dirname } of categories) {
            const categoryDir = path.join(this.archiveDir, dirname);
            fs.mkdirSync(categoryDir, { recursive: true });
        }
    }
    /**
     * Get the category subdirectory name
     */
    getCategoryDirName(category) {
        const mapping = {
            [types_1.FileCategory.TRANSLATION_WORK]: 'translation-work',
            [types_1.FileCategory.PERFORMANCE_REPORT]: 'performance-reports',
            [types_1.FileCategory.TEMPORARY_SUMMARY]: 'temporary-summaries',
            [types_1.FileCategory.SQL_REVIEW]: 'sql-files',
            [types_1.FileCategory.UNKNOWN]: 'unknown',
        };
        return mapping[category] || 'unknown';
    }
    /**
     * Archive a single file to the appropriate category subdirectory
     */
    archiveFile(file, category) {
        if (!this.archiveDir) {
            return {
                originalPath: file.path,
                archivePath: '',
                success: false,
                error: 'Archive structure not created. Call createArchiveStructure first.',
            };
        }
        try {
            const categoryDir = path.join(this.archiveDir, this.getCategoryDirName(category));
            let targetPath = path.join(categoryDir, file.name);
            // Handle name conflicts by appending timestamp
            if (fs.existsSync(targetPath)) {
                const timestamp = Date.now();
                const ext = path.extname(file.name);
                const basename = path.basename(file.name, ext);
                const newName = `${basename}_${timestamp}${ext}`;
                targetPath = path.join(categoryDir, newName);
            }
            // Move the file
            fs.renameSync(file.path, targetPath);
            // Preserve file timestamps
            const stats = fs.statSync(targetPath);
            fs.utimesSync(targetPath, stats.atime, file.modifiedTime);
            return {
                originalPath: file.path,
                archivePath: targetPath,
                success: true,
            };
        }
        catch (error) {
            return {
                originalPath: file.path,
                archivePath: '',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Generate an index file listing all archived files
     */
    generateArchiveIndex(results) {
        if (!this.archiveDir) {
            throw new Error('Archive structure not created. Call createArchiveStructure first.');
        }
        const indexPath = path.join(this.archiveDir, 'ARCHIVE_INDEX.md');
        let content = '# Archive Index\n\n';
        content += `Created: ${new Date().toISOString()}\n\n`;
        content += '## Archived Files\n\n';
        content += '| Original Path | Archive Location | Status |\n';
        content += '|---------------|------------------|--------|\n';
        for (const result of results) {
            const status = result.success ? '✓ Success' : `✗ Failed: ${result.error}`;
            const archivePath = result.success ? path.relative(this.archiveDir, result.archivePath) : 'N/A';
            content += `| ${result.originalPath} | ${archivePath} | ${status} |\n`;
        }
        content += `\n## Summary\n\n`;
        content += `- Total files: ${results.length}\n`;
        content += `- Successfully archived: ${results.filter(r => r.success).length}\n`;
        content += `- Failed: ${results.filter(r => !r.success).length}\n`;
        fs.writeFileSync(indexPath, content, 'utf-8');
    }
    /**
     * Get the archive directory path
     */
    getArchiveDir() {
        return this.archiveDir;
    }
}
exports.ArchiveManager = ArchiveManager;

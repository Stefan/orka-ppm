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
exports.Deleter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
/**
 * Allowed file extensions for deletion
 */
const ALLOWED_EXTENSIONS = new Set(['.md', '.log', '.txt', '.json', '.html', '.csv', '.css', '.tsbuildinfo', '']);
/**
 * Categories that are safe to delete
 */
const DELETABLE_CATEGORIES = new Set([
    types_1.FileCategory.TEMPORARY_SUMMARY,
    types_1.FileCategory.TEMPORARY_LOG,
]);
/**
 * Safely deletes temporary files with verification
 */
class Deleter {
    constructor(backupPath = '.kiro/cleanup-backup.json') {
        this.unknownFiles = [];
        this.backupPath = backupPath;
    }
    /**
     * Create a backup list of files to be deleted
     */
    createDeletionBackup(files) {
        const backupData = {
            timestamp: new Date().toISOString(),
            files: files.map(f => {
                // Handle invalid dates defensively
                let modifiedTimeStr;
                try {
                    modifiedTimeStr = f.modifiedTime.toISOString();
                }
                catch (error) {
                    // If date is invalid, use current time as fallback
                    modifiedTimeStr = new Date().toISOString();
                }
                return {
                    path: f.path,
                    name: f.name,
                    extension: f.extension,
                    size: f.size,
                    modifiedTime: modifiedTimeStr,
                };
            }),
        };
        // Ensure .kiro directory exists
        const backupDir = path.dirname(this.backupPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // Write backup file
        fs.writeFileSync(this.backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    }
    /**
     * Delete a file with safety checks
     */
    deleteFile(file, category) {
        const result = {
            path: file.path,
            category,
            success: false,
        };
        try {
            // Safety check 1: Verify category is deletable
            if (!DELETABLE_CATEGORIES.has(category)) {
                result.error = `Category ${category} is not deletable`;
                return result;
            }
            // Safety check 2: Verify file extension is allowed
            if (!ALLOWED_EXTENSIONS.has(file.extension)) {
                result.error = `Extension ${file.extension} is not allowed for deletion`;
                return result;
            }
            // Safety check 3: Verify file exists
            if (!fs.existsSync(file.path)) {
                result.error = 'File does not exist';
                return result;
            }
            // Delete the file
            fs.unlinkSync(file.path);
            result.success = true;
        }
        catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
        }
        return result;
    }
    /**
     * Track files that don't match any pattern (UNKNOWN category)
     */
    flagUnknownFile(file) {
        this.unknownFiles.push(file);
    }
    /**
     * Get all flagged unknown files
     */
    getUnknownFiles() {
        return [...this.unknownFiles];
    }
    /**
     * Verify deletion results
     */
    verifyDeletion(results) {
        return results.every(r => r.success);
    }
}
exports.Deleter = Deleter;

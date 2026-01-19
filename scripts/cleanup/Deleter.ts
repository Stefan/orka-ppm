import * as fs from 'fs';
import * as path from 'path';
import { FileInfo, FileCategory, DeletionResult } from './types';

/**
 * Allowed file extensions for deletion
 */
const ALLOWED_EXTENSIONS = new Set(['.md', '.log', '.txt', '.json', '.html', '.csv', '.css', '.tsbuildinfo', '']);

/**
 * Categories that are safe to delete
 */
const DELETABLE_CATEGORIES = new Set([
  FileCategory.TEMPORARY_SUMMARY,
  FileCategory.TEMPORARY_LOG,
]);

/**
 * Safely deletes temporary files with verification
 */
export class Deleter {
  private backupPath: string;
  private unknownFiles: FileInfo[] = [];

  constructor(backupPath: string = '.kiro/cleanup-backup.json') {
    this.backupPath = backupPath;
  }

  /**
   * Create a backup list of files to be deleted
   */
  createDeletionBackup(files: FileInfo[]): void {
    const backupData = {
      timestamp: new Date().toISOString(),
      files: files.map(f => {
        // Handle invalid dates defensively
        let modifiedTimeStr: string;
        try {
          modifiedTimeStr = f.modifiedTime.toISOString();
        } catch (error) {
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
  deleteFile(file: FileInfo, category: FileCategory): DeletionResult {
    const result: DeletionResult = {
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
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Track files that don't match any pattern (UNKNOWN category)
   */
  flagUnknownFile(file: FileInfo): void {
    this.unknownFiles.push(file);
  }

  /**
   * Get all flagged unknown files
   */
  getUnknownFiles(): FileInfo[] {
    return [...this.unknownFiles];
  }

  /**
   * Verify deletion results
   */
  verifyDeletion(results: DeletionResult[]): boolean {
    return results.every(r => r.success);
  }
}

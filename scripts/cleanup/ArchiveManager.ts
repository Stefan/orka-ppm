import * as fs from 'fs';
import * as path from 'path';
import { FileInfo, FileCategory, ArchiveConfig, ArchiveResult } from './types';

/**
 * Manages archiving of files into organized directory structure
 */
export class ArchiveManager {
  private config: ArchiveConfig | null = null;
  private archiveDir: string | null = null;

  /**
   * Create archive directory structure with timestamped folder
   * and subdirectories for each category
   */
  createArchiveStructure(config: ArchiveConfig): void {
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
      { category: FileCategory.TRANSLATION_WORK, dirname: 'translation-work' },
      { category: FileCategory.PERFORMANCE_REPORT, dirname: 'performance-reports' },
      { category: FileCategory.TEMPORARY_SUMMARY, dirname: 'temporary-summaries' },
      { category: FileCategory.SQL_REVIEW, dirname: 'sql-files' },
      { category: FileCategory.UNKNOWN, dirname: 'unknown' },
    ];
    
    for (const { dirname } of categories) {
      const categoryDir = path.join(this.archiveDir, dirname);
      fs.mkdirSync(categoryDir, { recursive: true });
    }
  }

  /**
   * Get the category subdirectory name
   */
  private getCategoryDirName(category: FileCategory): string {
    const mapping: Record<string, string> = {
      [FileCategory.TRANSLATION_WORK]: 'translation-work',
      [FileCategory.PERFORMANCE_REPORT]: 'performance-reports',
      [FileCategory.TEMPORARY_SUMMARY]: 'temporary-summaries',
      [FileCategory.SQL_REVIEW]: 'sql-files',
      [FileCategory.UNKNOWN]: 'unknown',
    };
    
    return mapping[category] || 'unknown';
  }

  /**
   * Archive a single file to the appropriate category subdirectory
   */
  archiveFile(file: FileInfo, category: FileCategory): ArchiveResult {
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
    } catch (error) {
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
  generateArchiveIndex(results: ArchiveResult[]): void {
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
  getArchiveDir(): string | null {
    return this.archiveDir;
  }
}

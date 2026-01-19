import * as fs from 'fs';
import * as path from 'path';
import { ReportGenerator } from '../ReportGenerator';
import { CleanupStats, FileInfo, FileCategory, ArchiveResult } from '../types';

describe('ReportGenerator', () => {
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  /**
   * Helper function to create a FileInfo object for testing
   */
  const createFileInfo = (name: string, size: number = 1024): FileInfo => ({
    path: `/test/${name}`,
    name,
    extension: name.includes('.') ? name.substring(name.lastIndexOf('.')) : '',
    size,
    modifiedTime: new Date('2024-01-15T10:00:00Z'),
  });

  /**
   * Helper function to create an ArchiveResult object for testing
   */
  const createArchiveResult = (originalName: string, archivePath: string): ArchiveResult => ({
    originalPath: `/test/${originalName}`,
    archivePath,
    success: true,
  });

  describe('generateSummary', () => {
    it('should generate a report with all required sections', () => {
      const stats: CleanupStats = {
        totalFiles: 100,
        filesDeleted: 30,
        filesArchived: 50,
        filesPreserved: 20,
        sizeReduced: 5000000,
        archiveLocation: '.kiro/archive/2024-01-15_cleanup',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('# Project Cleanup Summary Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Before/After Comparison');
      expect(report).toContain('## Deleted Files');
      expect(report).toContain('## Archived Files');
      expect(report).toContain('## Preserved Essential Files');
    });

    it('should include correct statistics in executive summary', () => {
      const stats: CleanupStats = {
        totalFiles: 100,
        filesDeleted: 30,
        filesArchived: 50,
        filesPreserved: 20,
        sizeReduced: 5242880, // 5 MB
        archiveLocation: '.kiro/archive/2024-01-15_cleanup',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('**Total Files Processed**: 100');
      expect(report).toContain('**Files Deleted**: 30');
      expect(report).toContain('**Files Archived**: 50');
      expect(report).toContain('**Files Preserved**: 20');
      expect(report).toContain('5 MB'); // Size formatted
      expect(report).toContain('`.kiro/archive/2024-01-15_cleanup`');
    });

    it('should list deleted files by category', () => {
      const stats: CleanupStats = {
        totalFiles: 10,
        filesDeleted: 3,
        filesArchived: 0,
        filesPreserved: 7,
        sizeReduced: 3072,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
      }
      deletedFiles.set(FileCategory.TEMPORARY_SUMMARY, [
        createFileInfo('TASK_12_SUMMARY.md'),
        createFileInfo('CHECKPOINT_4_REPORT.md'),
      ]);
      deletedFiles.set(FileCategory.TEMPORARY_LOG, [
        createFileInfo('test-output.log'),
      ]);

      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('## Deleted Files');
      expect(report).toContain('Temporary Summaries (2 files)');
      expect(report).toContain('`TASK_12_SUMMARY.md`');
      expect(report).toContain('`CHECKPOINT_4_REPORT.md`');
      expect(report).toContain('Temporary Logs (1 files)');
      expect(report).toContain('`test-output.log`');
    });

    it('should list archived files with new locations', () => {
      const stats: CleanupStats = {
        totalFiles: 10,
        filesDeleted: 0,
        filesArchived: 2,
        filesPreserved: 8,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/2024-01-15_cleanup',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
      }

      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        archivedFiles.set(category as FileCategory, []);
      }
      archivedFiles.set(FileCategory.TRANSLATION_WORK, [
        createArchiveResult('BATCH2_TRANSLATION_PLAN.md', '.kiro/archive/2024-01-15_cleanup/translation-work/BATCH2_TRANSLATION_PLAN.md'),
        createArchiveResult('I18N_TRANSLATION_PROGRESS.md', '.kiro/archive/2024-01-15_cleanup/translation-work/I18N_TRANSLATION_PROGRESS.md'),
      ]);

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('## Archived Files');
      expect(report).toContain('Translation Work (2 files)');
      expect(report).toContain('`BATCH2_TRANSLATION_PLAN.md`');
      expect(report).toContain('**New Location**: `.kiro/archive/2024-01-15_cleanup/translation-work/BATCH2_TRANSLATION_PLAN.md`');
      expect(report).toContain('`I18N_TRANSLATION_PROGRESS.md`');
      expect(report).toContain('**New Location**: `.kiro/archive/2024-01-15_cleanup/translation-work/I18N_TRANSLATION_PROGRESS.md`');
    });

    it('should list preserved essential files', () => {
      const stats: CleanupStats = {
        totalFiles: 5,
        filesDeleted: 0,
        filesArchived: 0,
        filesPreserved: 5,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const preservedFiles = [
        createFileInfo('TESTING_GUIDE.md'),
        createFileInfo('DEPLOYMENT.md'),
        createFileInfo('package.json'),
      ];

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        preservedFiles,
        []
      );

      expect(report).toContain('## Preserved Essential Files');
      expect(report).toContain('3 essential files were preserved');
      expect(report).toContain('`TESTING_GUIDE.md`');
      expect(report).toContain('`DEPLOYMENT.md`');
      expect(report).toContain('`package.json`');
    });

    it('should include unknown files section when unknown files exist', () => {
      const stats: CleanupStats = {
        totalFiles: 5,
        filesDeleted: 0,
        filesArchived: 0,
        filesPreserved: 3,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const unknownFiles = [
        createFileInfo('RANDOM_DOCUMENT.md'),
        createFileInfo('notes.txt'),
      ];

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        unknownFiles
      );

      expect(report).toContain('## Unknown Files (Manual Review Required)');
      expect(report).toContain('2 files did not match any known pattern');
      expect(report).toContain('`RANDOM_DOCUMENT.md`');
      expect(report).toContain('`notes.txt`');
      expect(report).toContain('**Recommendation**: Review these files manually');
    });

    it('should not include unknown files section when no unknown files', () => {
      const stats: CleanupStats = {
        totalFiles: 5,
        filesDeleted: 0,
        filesArchived: 0,
        filesPreserved: 5,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).not.toContain('## Unknown Files');
    });

    it('should include SQL-specific notes for archived SQL files', () => {
      const stats: CleanupStats = {
        totalFiles: 3,
        filesDeleted: 0,
        filesArchived: 2,
        filesPreserved: 1,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/2024-01-15_cleanup',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
      }

      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        archivedFiles.set(category as FileCategory, []);
      }
      archivedFiles.set(FileCategory.SQL_REVIEW, [
        createArchiveResult('COMPLETE_SETUP.sql', '.kiro/archive/2024-01-15_cleanup/sql-files/COMPLETE_SETUP.sql'),
        createArchiveResult('QUICK_FIX_ADMIN.sql', '.kiro/archive/2024-01-15_cleanup/sql-files/QUICK_FIX_ADMIN.sql'),
      ]);

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('SQL Files (2 files)');
      expect(report).toContain('not referenced in essential documentation');
      expect(report).toContain('DEPLOYMENT.md');
      expect(report).toContain('AUTH_SETUP_GUIDE.md');
      expect(report).toContain('**Status**: Manual review required');
      expect(report).toContain('`COMPLETE_SETUP.sql`');
      expect(report).toContain('`QUICK_FIX_ADMIN.sql`');
    });

    it('should calculate before/after comparison correctly', () => {
      const stats: CleanupStats = {
        totalFiles: 100,
        filesDeleted: 30,
        filesArchived: 50,
        filesPreserved: 20,
        sizeReduced: 5000000,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const unknownFiles = [
        createFileInfo('unknown1.txt'),
        createFileInfo('unknown2.txt'),
      ];

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        unknownFiles
      );

      expect(report).toContain('**Before Cleanup**: 100 files');
      expect(report).toContain('**After Cleanup**: 22 files'); // 20 preserved + 2 unknown
      expect(report).toContain('**Files Removed**: 78 files (78.0% reduction)');
    });

    it('should format file sizes correctly', () => {
      const stats: CleanupStats = {
        totalFiles: 10,
        filesDeleted: 5,
        filesArchived: 5,
        filesPreserved: 0,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
      }
      deletedFiles.set(FileCategory.TEMPORARY_LOG, [
        createFileInfo('small.log', 512), // 512 Bytes
        createFileInfo('medium.log', 5120), // 5 KB
        createFileInfo('large.log', 5242880), // 5 MB
      ]);

      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('512 Bytes');
      expect(report).toContain('5 KB');
      expect(report).toContain('5 MB');
    });

    it('should handle empty results gracefully', () => {
      const stats: CleanupStats = {
        totalFiles: 0,
        filesDeleted: 0,
        filesArchived: 0,
        filesPreserved: 0,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/empty',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('# Project Cleanup Summary Report');
      expect(report).toContain('**Total Files Processed**: 0');
      expect(report).toContain('No files were deleted.');
      expect(report).toContain('No files were archived.');
      expect(report).toContain('No essential files were identified.');
    });

    it('should include timestamp in report', () => {
      const stats: CleanupStats = {
        totalFiles: 0,
        filesDeleted: 0,
        filesArchived: 0,
        filesPreserved: 0,
        sizeReduced: 0,
        archiveLocation: '.kiro/archive/test',
      };

      const deletedFiles = new Map<FileCategory, FileInfo[]>();
      const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
      for (const category of Object.values(FileCategory)) {
        deletedFiles.set(category as FileCategory, []);
        archivedFiles.set(category as FileCategory, []);
      }

      const report = reportGenerator.generateSummary(
        stats,
        deletedFiles,
        archivedFiles,
        [],
        []
      );

      expect(report).toContain('Generated:');
      expect(report).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp format
    });
  });

  describe('writeReport', () => {
    const testOutputPath = path.join(__dirname, 'test-report.md');

    afterEach(() => {
      // Clean up test file
      if (fs.existsSync(testOutputPath)) {
        fs.unlinkSync(testOutputPath);
      }
    });

    it('should write report to file successfully', () => {
      const content = '# Test Report\n\nThis is a test report.';
      
      reportGenerator.writeReport(content, testOutputPath);

      expect(fs.existsSync(testOutputPath)).toBe(true);
      const writtenContent = fs.readFileSync(testOutputPath, 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('should throw error when writing to invalid path', () => {
      const content = '# Test Report';
      const invalidPath = '/invalid/path/that/does/not/exist/report.md';

      expect(() => {
        reportGenerator.writeReport(content, invalidPath);
      }).toThrow();
    });

    it('should overwrite existing file', () => {
      const content1 = '# First Report';
      const content2 = '# Second Report';

      reportGenerator.writeReport(content1, testOutputPath);
      expect(fs.readFileSync(testOutputPath, 'utf-8')).toBe(content1);

      reportGenerator.writeReport(content2, testOutputPath);
      expect(fs.readFileSync(testOutputPath, 'utf-8')).toBe(content2);
    });
  });
});

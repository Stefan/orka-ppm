/**
 * Property-Based Test for Essential File Preservation
 * 
 * This test verifies that essential files are never deleted or archived during cleanup.
 * 
 * Feature: project-cleanup, Property 3: Essential File Preservation
 * Validates: Requirements 1.5, 4.5
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileScanner } from '../FileScanner';
import { Categorizer } from '../Categorizer';
import { ArchiveManager } from '../ArchiveManager';
import { Deleter } from '../Deleter';
import { SqlReferenceChecker } from '../SqlReferenceChecker';
import { FileCategory, FileInfo } from '../types';

describe('Essential File Preservation - Property-Based Tests', () => {
  let testDir: string;
  let archiveDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
    archiveDir = path.join(testDir, '.kiro', 'archive');
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Generator for essential file names
   */
  const essentialFileArb = fc.constantFrom(
    'TESTING_GUIDE.md',
    'DESIGN_SYSTEM_GUIDE.md',
    'DEPLOYMENT.md',
    'AUTH_SETUP_GUIDE.md',
    'I18N_DEVELOPER_GUIDE.md',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.prod.json',
    'next.config.ts',
    'tailwind.config.ts',
    'postcss.config.mjs',
    'eslint.config.mjs',
    'jest.config.js',
    'jest.setup.js',
    'jest.env.js',
    'playwright.config.ts',
    'lighthouserc.js',
    'vercel.json',
    'render.yaml',
    '.env.local',
    '.env.production',
    '.gitignore',
    '.gitmodules',
    '.npmrc',
    '.vercelignore',
    'Dockerfile',
    'deploy.sh',
    'README.md',
    'pytest.ini'
  );

  /**
   * Generator for non-essential file names (temporary files)
   * Uses alphanumeric strings to avoid invalid filename characters
   */
  const temporaryFileArb = fc.oneof(
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `TASK_${s}_SUMMARY.md`),
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `CHECKPOINT_${s}_REPORT.md`),
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `FINAL_${s}_SUMMARY.md`),
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `TEST${s}_COMPLETION_SUMMARY.md`),
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `TEST${s}_FIX_SUMMARY.md`),
    fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(s => `test${s}.log`),
    fc.constantFrom('test-results.json', 'test-output.log', 'chrome-scroll-test.html')
  );

  /**
   * Generator for file content
   */
  const fileContentArb = fc.string({ minLength: 10, maxLength: 1000 });

  /**
   * Generator for valid dates (no NaN)
   */
  const validDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') })
    .filter(d => !isNaN(d.getTime()));

  /**
   * Helper function to create a file with specific content and timestamp
   */
  function createTestFile(dir: string, filename: string, content: string, mtime: Date): FileInfo {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    fs.utimesSync(filePath, mtime, mtime);
    
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: filename,
      extension: path.extname(filename),
      size: stats.size,
      modifiedTime: stats.mtime,
    };
  }

  /**
   * Helper function to verify file exists with same content and timestamp
   */
  function verifyFilePreserved(
    filePath: string,
    originalContent: string,
    originalMtime: Date,
    tolerance: number = 1000 // 1 second tolerance for timestamp comparison
  ): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const currentContent = fs.readFileSync(filePath, 'utf-8');
    if (currentContent !== originalContent) {
      return false;
    }

    const stats = fs.statSync(filePath);
    const timeDiff = Math.abs(stats.mtime.getTime() - originalMtime.getTime());
    if (timeDiff > tolerance) {
      return false;
    }

    return true;
  }

  // Feature: project-cleanup, Property 3: Essential File Preservation
  describe('Property 3: Essential File Preservation', () => {
    it('should preserve essential files in their original location after categorization', () => {
      fc.assert(
        fc.property(
          essentialFileArb,
          fileContentArb,
          validDateArb,
          (filename, content, mtime) => {
            // Create essential file
            const fileInfo = createTestFile(testDir, filename, content, mtime);

            // Initialize components
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);

            // Categorize the file
            const category = categorizer.categorizeFile(fileInfo);

            // Property: Essential files must be categorized as ESSENTIAL
            expect(category).toBe(FileCategory.ESSENTIAL);

            // Property: File must still exist in original location
            expect(fs.existsSync(fileInfo.path)).toBe(true);

            // Property: File content must be unchanged
            const currentContent = fs.readFileSync(fileInfo.path, 'utf-8');
            expect(currentContent).toBe(content);

            // Property: File timestamp must be unchanged (within tolerance)
            const stats = fs.statSync(fileInfo.path);
            const timeDiff = Math.abs(stats.mtime.getTime() - mtime.getTime());
            expect(timeDiff).toBeLessThan(1000); // 1 second tolerance
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never archive essential files', () => {
      fc.assert(
        fc.property(
          essentialFileArb,
          fileContentArb,
          validDateArb,
          (filename, content, mtime) => {
            // Create essential file
            const fileInfo = createTestFile(testDir, filename, content, mtime);

            // Initialize components
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);
            const archiveManager = new ArchiveManager();

            // Categorize the file
            const category = categorizer.categorizeFile(fileInfo);

            // Create archive structure
            archiveManager.createArchiveStructure({
              archiveRoot: archiveDir,
              timestamp: '2024-01-15',
            });

            // Property: Essential files should not be archived
            // (Archive manager should only be called for non-essential categories)
            expect(category).toBe(FileCategory.ESSENTIAL);

            // Property: File must still exist in original location
            expect(fs.existsSync(fileInfo.path)).toBe(true);

            // Property: File should not exist in archive
            const archivePath = path.join(archiveDir, '2024-01-15_cleanup', 'essential', filename);
            expect(fs.existsSync(archivePath)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never delete essential files', () => {
      fc.assert(
        fc.property(
          essentialFileArb,
          fileContentArb,
          validDateArb,
          (filename, content, mtime) => {
            // Create essential file
            const fileInfo = createTestFile(testDir, filename, content, mtime);

            // Initialize components
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);
            const deleter = new Deleter(path.join(testDir, '.kiro', 'cleanup-backup.json'));

            // Categorize the file
            const category = categorizer.categorizeFile(fileInfo);

            // Attempt to delete (should fail safety checks)
            const result = deleter.deleteFile(fileInfo, category);

            // Property: Deletion should fail for essential files
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // Property: File must still exist in original location
            expect(fs.existsSync(fileInfo.path)).toBe(true);

            // Property: File content must be unchanged
            const currentContent = fs.readFileSync(fileInfo.path, 'utf-8');
            expect(currentContent).toBe(content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve essential files while processing temporary files', () => {
      fc.assert(
        fc.property(
          essentialFileArb,
          temporaryFileArb,
          fileContentArb,
          fileContentArb,
          validDateArb,
          (essentialFile, tempFile, essentialContent, tempContent, mtime) => {
            // Create both essential and temporary files
            const essentialFileInfo = createTestFile(testDir, essentialFile, essentialContent, mtime);
            const tempFileInfo = createTestFile(testDir, tempFile, tempContent, mtime);

            // Initialize components
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);
            const deleter = new Deleter(path.join(testDir, '.kiro', 'cleanup-backup.json'));

            // Categorize both files
            const essentialCategory = categorizer.categorizeFile(essentialFileInfo);
            const tempCategory = categorizer.categorizeFile(tempFileInfo);

            // Property: Essential file should be categorized as ESSENTIAL
            expect(essentialCategory).toBe(FileCategory.ESSENTIAL);

            // Property: Temporary file should not be categorized as ESSENTIAL
            expect(tempCategory).not.toBe(FileCategory.ESSENTIAL);

            // Create backup and delete temporary file
            deleter.createDeletionBackup([tempFileInfo]);
            const deletionResult = deleter.deleteFile(tempFileInfo, tempCategory);

            // Property: Essential file must still exist after temporary file deletion
            expect(fs.existsSync(essentialFileInfo.path)).toBe(true);

            // Property: Essential file content must be unchanged
            const currentContent = fs.readFileSync(essentialFileInfo.path, 'utf-8');
            expect(currentContent).toBe(essentialContent);

            // Property: Essential file timestamp must be unchanged (within tolerance)
            const stats = fs.statSync(essentialFileInfo.path);
            const timeDiff = Math.abs(stats.mtime.getTime() - mtime.getTime());
            expect(timeDiff).toBeLessThan(1000); // 1 second tolerance

            // Property: Temporary file should be deleted if it's in a deletable category
            if (deletionResult.success) {
              expect(fs.existsSync(tempFileInfo.path)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all essential files in a mixed file set', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(essentialFileArb, { minLength: 1, maxLength: 10 }),
          fc.uniqueArray(temporaryFileArb, { minLength: 1, maxLength: 10 }),
          validDateArb,
          (essentialFiles, tempFiles, mtime) => {
            // Create all files
            const essentialFileInfos: Array<{ info: FileInfo; content: string }> = [];
            const tempFileInfos: FileInfo[] = [];

            // Create essential files
            for (const filename of essentialFiles) {
              const content = `Essential content for ${filename}`;
              const fileInfo = createTestFile(testDir, filename, content, mtime);
              essentialFileInfos.push({ info: fileInfo, content });
            }

            // Create temporary files
            for (const filename of tempFiles) {
              const content = `Temporary content for ${filename}`;
              const fileInfo = createTestFile(testDir, filename, content, mtime);
              tempFileInfos.push(fileInfo);
            }

            // Initialize components
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);
            const deleter = new Deleter(path.join(testDir, '.kiro', 'cleanup-backup.json'));

            // Scan and categorize all files
            const allFiles = scanner.scanRootDirectory();
            const categorized = categorizer.categorizeFiles(allFiles);

            // Get essential files from categorization (only the ones we created)
            const categorizedEssential = categorized.get(FileCategory.ESSENTIAL) || [];
            const ourEssentialFiles = categorizedEssential.filter(f => 
              essentialFileInfos.some(info => info.info.name === f.name)
            );

            // Property: All essential files must be categorized as ESSENTIAL
            expect(ourEssentialFiles.length).toBe(essentialFileInfos.length);

            // Process temporary files (delete them)
            const filesToDelete = [
              ...(categorized.get(FileCategory.TEMPORARY_SUMMARY) || []),
              ...(categorized.get(FileCategory.TEMPORARY_LOG) || []),
            ];

            if (filesToDelete.length > 0) {
              deleter.createDeletionBackup(filesToDelete);
              for (const file of filesToDelete) {
                const category = categorizer.categorizeFile(file);
                deleter.deleteFile(file, category);
              }
            }

            // Property: All essential files must still exist
            for (const { info, content } of essentialFileInfos) {
              expect(fs.existsSync(info.path)).toBe(true);

              // Property: Content must be unchanged
              const currentContent = fs.readFileSync(info.path, 'utf-8');
              expect(currentContent).toBe(content);

              // Property: Timestamp must be unchanged (within tolerance)
              const stats = fs.statSync(info.path);
              const timeDiff = Math.abs(stats.mtime.getTime() - mtime.getTime());
              expect(timeDiff).toBeLessThan(1000); // 1 second tolerance
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to file system operations
      );
    });

    it('should verify essential files remain after full cleanup simulation', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(essentialFileArb, { minLength: 2, maxLength: 5 }),
          validDateArb,
          (essentialFiles, mtime) => {
            // Create essential files with unique content
            const fileData: Array<{ info: FileInfo; content: string; mtime: Date }> = [];

            for (const filename of essentialFiles) {
              const content = `Essential content for ${filename} - ${Date.now()}`;
              const fileInfo = createTestFile(testDir, filename, content, mtime);
              fileData.push({ info: fileInfo, content, mtime });
            }

            // Initialize components for full cleanup simulation
            const scanner = new FileScanner(testDir);
            const sqlChecker = new SqlReferenceChecker(testDir);
            const categorizer = new Categorizer(scanner, sqlChecker);
            const archiveManager = new ArchiveManager();
            const deleter = new Deleter(path.join(testDir, '.kiro', 'cleanup-backup.json'));

            // Scan and categorize
            const allFiles = scanner.scanRootDirectory();
            const categorized = categorizer.categorizeFiles(allFiles);

            // Create archive structure
            archiveManager.createArchiveStructure({
              archiveRoot: archiveDir,
              timestamp: '2024-01-15',
            });

            // Archive non-essential files (should be none in this test)
            const categoriesToArchive = [
              FileCategory.TRANSLATION_WORK,
              FileCategory.PERFORMANCE_REPORT,
              FileCategory.SQL_REVIEW,
            ];

            for (const category of categoriesToArchive) {
              const files = categorized.get(category) || [];
              for (const file of files) {
                archiveManager.archiveFile(file, category);
              }
            }

            // Delete temporary files (should be none in this test)
            const categoriesToDelete = [
              FileCategory.TEMPORARY_SUMMARY,
              FileCategory.TEMPORARY_LOG,
            ];

            const filesToDelete: FileInfo[] = [];
            for (const category of categoriesToDelete) {
              const files = categorized.get(category) || [];
              filesToDelete.push(...files);
            }

            if (filesToDelete.length > 0) {
              deleter.createDeletionBackup(filesToDelete);
              for (const file of filesToDelete) {
                const category = categorizer.categorizeFile(file);
                deleter.deleteFile(file, category);
              }
            }

            // Property: All essential files must still exist after full cleanup
            for (const { info, content, mtime: originalMtime } of fileData) {
              expect(verifyFilePreserved(info.path, content, originalMtime)).toBe(true);
            }

            // Property: Essential files count should match original count
            const remainingFiles = scanner.scanRootDirectory();
            const remainingEssential = categorizer.categorizeFiles(remainingFiles)
              .get(FileCategory.ESSENTIAL) || [];
            
            // Only count the files we created
            const ourRemainingFiles = remainingEssential.filter(f =>
              fileData.some(data => data.info.name === f.name)
            );
            
            expect(ourRemainingFiles.length).toBe(fileData.length);
          }
        ),
        { numRuns: 50 } // Reduced runs due to file system operations
      );
    });
  });
});

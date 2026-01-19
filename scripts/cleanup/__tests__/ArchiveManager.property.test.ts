import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { ArchiveManager } from '../ArchiveManager';
import { FileInfo, FileCategory, ArchiveConfig } from '../types';

// Feature: project-cleanup, Property 4: Archive Structure Consistency
describe('ArchiveManager Property Tests', () => {
  const testArchiveRoot = path.join(__dirname, 'test-archives');

  beforeEach(() => {
    // Clean up test archives before each test
    if (fs.existsSync(testArchiveRoot)) {
      fs.rmSync(testArchiveRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testArchiveRoot, { recursive: true });
  });

  afterEach(() => {
    // Clean up test archives after each test
    if (fs.existsSync(testArchiveRoot)) {
      fs.rmSync(testArchiveRoot, { recursive: true, force: true });
    }
  });

  // Property 4: Archive Structure Consistency
  // Validates: Requirements 2.1
  test('Property 4: Archive structure should be organized by category with timestamp', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (date) => {
          const timestamp = date.toISOString().split('T')[0];
          const config: ArchiveConfig = {
            archiveRoot: testArchiveRoot,
            timestamp,
          };

          const manager = new ArchiveManager();
          manager.createArchiveStructure(config);

          const archiveDir = manager.getArchiveDir();
          expect(archiveDir).toBeTruthy();
          expect(archiveDir).toContain(timestamp);
          expect(archiveDir).toContain('_cleanup');

          // Verify main archive directory exists
          expect(fs.existsSync(archiveDir!)).toBe(true);

          // Verify category subdirectories exist
          const expectedDirs = [
            'translation-work',
            'performance-reports',
            'temporary-summaries',
            'sql-files',
            'unknown',
          ];

          for (const dirname of expectedDirs) {
            const categoryDir = path.join(archiveDir!, dirname);
            expect(fs.existsSync(categoryDir)).toBe(true);
            expect(fs.statSync(categoryDir).isDirectory()).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 5: Timestamp Preservation During Archiving
  // Validates: Requirements 2.2
  test('Property 5: File timestamps should be preserved during archiving', () => {
    const testFilesRoot = path.join(__dirname, 'test-files');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/') && !s.includes('\\') && s.trim().length > 0),
        fc.constantFrom('.md', '.log', '.txt', '.json'),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).filter(d => !isNaN(d.getTime())),
        fc.constantFrom(
          FileCategory.TRANSLATION_WORK,
          FileCategory.PERFORMANCE_REPORT,
          FileCategory.TEMPORARY_SUMMARY,
          FileCategory.SQL_REVIEW
        ),
        (basename, ext, modifiedTime, category) => {
          // Setup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
          fs.mkdirSync(testFilesRoot, { recursive: true });

          const filename = `${basename}${ext}`;
          const filePath = path.join(testFilesRoot, filename);
          
          // Create test file
          fs.writeFileSync(filePath, 'test content');
          fs.utimesSync(filePath, modifiedTime, modifiedTime);

          const fileInfo: FileInfo = {
            path: filePath,
            name: filename,
            extension: ext,
            size: fs.statSync(filePath).size,
            modifiedTime,
          };

          // Create archive structure
          const config: ArchiveConfig = {
            archiveRoot: testArchiveRoot,
            timestamp: '2024-01-15',
          };

          const manager = new ArchiveManager();
          manager.createArchiveStructure(config);

          // Archive the file
          const result = manager.archiveFile(fileInfo, category);

          // Verify
          if (result.success) {
            expect(fs.existsSync(result.archivePath)).toBe(true);
            const archivedStats = fs.statSync(result.archivePath);
            
            // Compare timestamps (allow 1 second tolerance for filesystem precision)
            const timeDiff = Math.abs(archivedStats.mtime.getTime() - modifiedTime.getTime());
            expect(timeDiff).toBeLessThan(1000);
          }

          // Cleanup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6: Archive Index Completeness
  // Validates: Requirements 2.3, 6.3
  test('Property 6: Archive index should contain entries for all archived files', () => {
    const testFilesRoot = path.join(__dirname, 'test-files');

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/') && !s.includes('\\')),
            ext: fc.constantFrom('.md', '.log', '.txt'),
            category: fc.constantFrom(
              FileCategory.TRANSLATION_WORK,
              FileCategory.PERFORMANCE_REPORT,
              FileCategory.TEMPORARY_SUMMARY
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (fileSpecs) => {
          // Setup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
          fs.mkdirSync(testFilesRoot, { recursive: true });

          const results = [];
          const config: ArchiveConfig = {
            archiveRoot: testArchiveRoot,
            timestamp: '2024-01-15',
          };

          const manager = new ArchiveManager();
          manager.createArchiveStructure(config);

          // Create and archive files
          for (const spec of fileSpecs) {
            const filename = `${spec.name}${spec.ext}`;
            const filePath = path.join(testFilesRoot, filename);
            
            fs.writeFileSync(filePath, 'test content');
            
            const fileInfo: FileInfo = {
              path: filePath,
              name: filename,
              extension: spec.ext,
              size: fs.statSync(filePath).size,
              modifiedTime: new Date(),
            };

            const result = manager.archiveFile(fileInfo, spec.category);
            results.push(result);
          }

          // Generate index
          manager.generateArchiveIndex(results);

          // Verify index exists and contains all files
          const archiveDir = manager.getArchiveDir();
          const indexPath = path.join(archiveDir!, 'ARCHIVE_INDEX.md');
          
          expect(fs.existsSync(indexPath)).toBe(true);
          
          const indexContent = fs.readFileSync(indexPath, 'utf-8');
          
          // Verify all files are mentioned in the index
          for (const result of results) {
            expect(indexContent).toContain(result.originalPath);
          }

          // Verify summary statistics
          expect(indexContent).toContain(`Total files: ${results.length}`);
          expect(indexContent).toContain('Successfully archived:');

          // Cleanup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 7: Archive Conflict Resolution
  // Validates: Requirements 2.5
  test('Property 7: Name conflicts should be resolved by appending timestamp', () => {
    const testFilesRoot = path.join(__dirname, 'test-files');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/') && !s.includes('\\')),
        fc.constantFrom('.md', '.log', '.txt'),
        fc.constantFrom(
          FileCategory.TRANSLATION_WORK,
          FileCategory.PERFORMANCE_REPORT,
          FileCategory.TEMPORARY_SUMMARY
        ),
        (basename, ext, category) => {
          // Setup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
          fs.mkdirSync(testFilesRoot, { recursive: true });

          const filename = `${basename}${ext}`;
          const config: ArchiveConfig = {
            archiveRoot: testArchiveRoot,
            timestamp: '2024-01-15',
          };

          const manager = new ArchiveManager();
          manager.createArchiveStructure(config);

          // Create and archive first file
          const filePath1 = path.join(testFilesRoot, filename);
          fs.writeFileSync(filePath1, 'content 1');
          
          const fileInfo1: FileInfo = {
            path: filePath1,
            name: filename,
            extension: ext,
            size: fs.statSync(filePath1).size,
            modifiedTime: new Date(),
          };

          const result1 = manager.archiveFile(fileInfo1, category);
          expect(result1.success).toBe(true);

          // Create and archive second file with same name
          const filePath2 = path.join(testFilesRoot, filename);
          fs.writeFileSync(filePath2, 'content 2');
          
          const fileInfo2: FileInfo = {
            path: filePath2,
            name: filename,
            extension: ext,
            size: fs.statSync(filePath2).size,
            modifiedTime: new Date(),
          };

          const result2 = manager.archiveFile(fileInfo2, category);
          expect(result2.success).toBe(true);

          // Verify both files exist with different names
          expect(fs.existsSync(result1.archivePath)).toBe(true);
          expect(fs.existsSync(result2.archivePath)).toBe(true);
          expect(result1.archivePath).not.toBe(result2.archivePath);

          // Verify second file has timestamp appended
          const basename2 = path.basename(result2.archivePath, ext);
          expect(basename2).toContain('_');
          expect(basename2).toMatch(/\d+/); // Contains numeric timestamp

          // Cleanup
          if (fs.existsSync(testFilesRoot)) {
            fs.rmSync(testFilesRoot, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

import * as fs from 'fs';
import * as path from 'path';
import { ArchiveManager } from '../ArchiveManager';
import { FileInfo, FileCategory, ArchiveConfig } from '../types';

describe('ArchiveManager Unit Tests', () => {
  const testArchiveRoot = path.join(__dirname, 'test-archives-unit');
  const testFilesRoot = path.join(__dirname, 'test-files-unit');

  beforeEach(() => {
    // Clean up test directories
    if (fs.existsSync(testArchiveRoot)) {
      fs.rmSync(testArchiveRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(testFilesRoot)) {
      fs.rmSync(testFilesRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testArchiveRoot, { recursive: true });
    fs.mkdirSync(testFilesRoot, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testArchiveRoot)) {
      fs.rmSync(testArchiveRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(testFilesRoot)) {
      fs.rmSync(testFilesRoot, { recursive: true, force: true });
    }
  });

  describe('createArchiveStructure', () => {
    test('should create timestamped archive directory', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      const archiveDir = manager.getArchiveDir();
      expect(archiveDir).toBeTruthy();
      expect(archiveDir).toContain('2024-01-15_cleanup');
      expect(fs.existsSync(archiveDir!)).toBe(true);
    });

    test('should create category subdirectories', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      const archiveDir = manager.getArchiveDir();
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
    });

    test('should handle conflicts by appending counter', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager1 = new ArchiveManager();
      manager1.createArchiveStructure(config);
      const archiveDir1 = manager1.getArchiveDir();

      const manager2 = new ArchiveManager();
      manager2.createArchiveStructure(config);
      const archiveDir2 = manager2.getArchiveDir();

      expect(archiveDir1).toContain('2024-01-15_cleanup');
      expect(archiveDir2).toContain('2024-01-15_cleanup_2');
      expect(archiveDir1).not.toBe(archiveDir2);
    });
  });

  describe('archiveFile', () => {
    test('should move file to correct category subdirectory', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      // Create test file
      const filename = 'test-summary.md';
      const filePath = path.join(testFilesRoot, filename);
      fs.writeFileSync(filePath, 'test content');

      const fileInfo: FileInfo = {
        path: filePath,
        name: filename,
        extension: '.md',
        size: fs.statSync(filePath).size,
        modifiedTime: new Date('2024-01-10'),
      };

      const result = manager.archiveFile(fileInfo, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(true);
      expect(result.originalPath).toBe(filePath);
      expect(result.archivePath).toContain('temporary-summaries');
      expect(fs.existsSync(result.archivePath)).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should preserve file timestamps', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      // Create test file with specific timestamp
      const filename = 'test-file.md';
      const filePath = path.join(testFilesRoot, filename);
      const modifiedTime = new Date('2024-01-10T12:00:00Z');
      
      fs.writeFileSync(filePath, 'test content');
      fs.utimesSync(filePath, modifiedTime, modifiedTime);

      const fileInfo: FileInfo = {
        path: filePath,
        name: filename,
        extension: '.md',
        size: fs.statSync(filePath).size,
        modifiedTime,
      };

      const result = manager.archiveFile(fileInfo, FileCategory.TRANSLATION_WORK);

      expect(result.success).toBe(true);
      
      const archivedStats = fs.statSync(result.archivePath);
      const timeDiff = Math.abs(archivedStats.mtime.getTime() - modifiedTime.getTime());
      expect(timeDiff).toBeLessThan(1000); // Allow 1 second tolerance
    });

    test('should handle name conflicts by appending timestamp', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      // Create first file
      const filename = 'duplicate.md';
      const filePath1 = path.join(testFilesRoot, filename);
      fs.writeFileSync(filePath1, 'content 1');

      const fileInfo1: FileInfo = {
        path: filePath1,
        name: filename,
        extension: '.md',
        size: fs.statSync(filePath1).size,
        modifiedTime: new Date(),
      };

      const result1 = manager.archiveFile(fileInfo1, FileCategory.PERFORMANCE_REPORT);
      expect(result1.success).toBe(true);

      // Create second file with same name
      const filePath2 = path.join(testFilesRoot, filename);
      fs.writeFileSync(filePath2, 'content 2');

      const fileInfo2: FileInfo = {
        path: filePath2,
        name: filename,
        extension: '.md',
        size: fs.statSync(filePath2).size,
        modifiedTime: new Date(),
      };

      const result2 = manager.archiveFile(fileInfo2, FileCategory.PERFORMANCE_REPORT);
      expect(result2.success).toBe(true);

      // Verify both files exist with different names
      expect(fs.existsSync(result1.archivePath)).toBe(true);
      expect(fs.existsSync(result2.archivePath)).toBe(true);
      expect(result1.archivePath).not.toBe(result2.archivePath);
      
      // Verify second file has timestamp in name
      expect(path.basename(result2.archivePath)).toMatch(/duplicate_\d+\.md/);
    });

    test('should return error if archive structure not created', () => {
      const manager = new ArchiveManager();

      const filename = 'test.md';
      const filePath = path.join(testFilesRoot, filename);
      fs.writeFileSync(filePath, 'test content');

      const fileInfo: FileInfo = {
        path: filePath,
        name: filename,
        extension: '.md',
        size: fs.statSync(filePath).size,
        modifiedTime: new Date(),
      };

      const result = manager.archiveFile(fileInfo, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Archive structure not created');
    });

    test('should handle file system errors gracefully', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      // Try to archive non-existent file
      const fileInfo: FileInfo = {
        path: '/non/existent/file.md',
        name: 'file.md',
        extension: '.md',
        size: 100,
        modifiedTime: new Date(),
      };

      const result = manager.archiveFile(fileInfo, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('generateArchiveIndex', () => {
    test('should create index file with all archived files', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      const results = [
        {
          originalPath: '/root/file1.md',
          archivePath: path.join(manager.getArchiveDir()!, 'temporary-summaries', 'file1.md'),
          success: true,
        },
        {
          originalPath: '/root/file2.md',
          archivePath: path.join(manager.getArchiveDir()!, 'translation-work', 'file2.md'),
          success: true,
        },
      ];

      manager.generateArchiveIndex(results);

      const indexPath = path.join(manager.getArchiveDir()!, 'ARCHIVE_INDEX.md');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('# Archive Index');
      expect(content).toContain('/root/file1.md');
      expect(content).toContain('/root/file2.md');
      expect(content).toContain('Total files: 2');
      expect(content).toContain('Successfully archived: 2');
    });

    test('should include failed operations in index', () => {
      const config: ArchiveConfig = {
        archiveRoot: testArchiveRoot,
        timestamp: '2024-01-15',
      };

      const manager = new ArchiveManager();
      manager.createArchiveStructure(config);

      const results = [
        {
          originalPath: '/root/success.md',
          archivePath: path.join(manager.getArchiveDir()!, 'temporary-summaries', 'success.md'),
          success: true,
        },
        {
          originalPath: '/root/failed.md',
          archivePath: '',
          success: false,
          error: 'Permission denied',
        },
      ];

      manager.generateArchiveIndex(results);

      const indexPath = path.join(manager.getArchiveDir()!, 'ARCHIVE_INDEX.md');
      const content = fs.readFileSync(indexPath, 'utf-8');

      expect(content).toContain('/root/success.md');
      expect(content).toContain('/root/failed.md');
      expect(content).toContain('✓ Success');
      expect(content).toContain('✗ Failed');
      expect(content).toContain('Successfully archived: 1');
      expect(content).toContain('Failed: 1');
    });

    test('should throw error if archive structure not created', () => {
      const manager = new ArchiveManager();

      expect(() => {
        manager.generateArchiveIndex([]);
      }).toThrow('Archive structure not created');
    });
  });
});

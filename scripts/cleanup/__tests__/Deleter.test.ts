/**
 * Unit Tests for Deleter Component
 * Tests backup creation, deletion with allowed/disallowed extensions, and error handling
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { Deleter } from '../Deleter';
import { FileInfo, FileCategory } from '../types';

describe('Deleter', () => {
  const testDir = path.join(__dirname, 'test-deleter');
  const testBackupPath = path.join(testDir, 'test-backup.json');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory recursively
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createDeletionBackup', () => {
    it('should create backup file with correct structure', () => {
      const deleter = new Deleter(testBackupPath);
      const files: FileInfo[] = [
        {
          path: '/root/TASK_1_SUMMARY.md',
          name: 'TASK_1_SUMMARY.md',
          extension: '.md',
          size: 1024,
          modifiedTime: new Date('2024-01-15T10:00:00Z'),
        },
        {
          path: '/root/test.log',
          name: 'test.log',
          extension: '.log',
          size: 512,
          modifiedTime: new Date('2024-01-15T11:00:00Z'),
        },
      ];

      deleter.createDeletionBackup(files);

      expect(fs.existsSync(testBackupPath)).toBe(true);

      const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
      const backup = JSON.parse(backupContent);

      expect(backup.timestamp).toBeDefined();
      expect(backup.files).toHaveLength(2);
      expect(backup.files[0].path).toBe('/root/TASK_1_SUMMARY.md');
      expect(backup.files[0].name).toBe('TASK_1_SUMMARY.md');
      expect(backup.files[0].extension).toBe('.md');
      expect(backup.files[0].size).toBe(1024);
      expect(backup.files[1].path).toBe('/root/test.log');
    });

    it('should create .kiro directory if it does not exist', () => {
      const backupPath = path.join(testDir, '.kiro', 'backup.json');
      const deleter = new Deleter(backupPath);
      const files: FileInfo[] = [
        {
          path: '/root/test.md',
          name: 'test.md',
          extension: '.md',
          size: 100,
          modifiedTime: new Date(),
        },
      ];

      deleter.createDeletionBackup(files);

      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should handle empty file list', () => {
      const deleter = new Deleter(testBackupPath);
      const files: FileInfo[] = [];

      deleter.createDeletionBackup(files);

      expect(fs.existsSync(testBackupPath)).toBe(true);

      const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
      const backup = JSON.parse(backupContent);

      expect(backup.files).toHaveLength(0);
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete file with allowed extension and deletable category', () => {
      const filePath = path.join(testDir, 'TASK_1_SUMMARY.md');
      fs.writeFileSync(filePath, 'test content', 'utf-8');

      const file: FileInfo = {
        path: filePath,
        name: 'TASK_1_SUMMARY.md',
        extension: '.md',
        size: 100,
        modifiedTime: new Date(),
      };

      const deleter = new Deleter();
      const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);
      expect(result.category).toBe(FileCategory.TEMPORARY_SUMMARY);
      expect(result.error).toBeUndefined();
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should reject deletion of file with disallowed extension', () => {
      const filePath = path.join(testDir, 'script.ts');
      fs.writeFileSync(filePath, 'test content', 'utf-8');

      const file: FileInfo = {
        path: filePath,
        name: 'script.ts',
        extension: '.ts',
        size: 100,
        modifiedTime: new Date(),
      };

      const deleter = new Deleter();
      const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed for deletion');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should reject deletion of file in non-deletable category', () => {
      const filePath = path.join(testDir, 'important.md');
      fs.writeFileSync(filePath, 'test content', 'utf-8');

      const file: FileInfo = {
        path: filePath,
        name: 'important.md',
        extension: '.md',
        size: 100,
        modifiedTime: new Date(),
      };

      const deleter = new Deleter();
      const result = deleter.deleteFile(file, FileCategory.ESSENTIAL);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not deletable');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should handle deletion of non-existent file', () => {
      const filePath = path.join(testDir, 'nonexistent.md');

      const file: FileInfo = {
        path: filePath,
        name: 'nonexistent.md',
        extension: '.md',
        size: 100,
        modifiedTime: new Date(),
      };

      const deleter = new Deleter();
      const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should delete files with all allowed extensions', () => {
      const allowedExtensions = ['.md', '.log', '.txt', '.json', '.html', '.csv'];

      for (const ext of allowedExtensions) {
        const fileName = `test${ext}`;
        const filePath = path.join(testDir, fileName);
        fs.writeFileSync(filePath, 'test content', 'utf-8');

        const file: FileInfo = {
          path: filePath,
          name: fileName,
          extension: ext,
          size: 100,
          modifiedTime: new Date(),
        };

        const deleter = new Deleter();
        const result = deleter.deleteFile(file, FileCategory.TEMPORARY_LOG);

        expect(result.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(false);
      }
    });

    it('should reject files with disallowed extensions', () => {
      const disallowedExtensions = ['.ts', '.js', '.py', '.exe', '.sh', '.sql'];

      for (const ext of disallowedExtensions) {
        const fileName = `test${ext}`;
        const filePath = path.join(testDir, fileName);
        fs.writeFileSync(filePath, 'test content', 'utf-8');

        const file: FileInfo = {
          path: filePath,
          name: fileName,
          extension: ext,
          size: 100,
          modifiedTime: new Date(),
        };

        const deleter = new Deleter();
        const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowed for deletion');
        expect(fs.existsSync(filePath)).toBe(true);

        // Clean up
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('flagUnknownFile', () => {
    it('should flag a single unknown file', () => {
      const deleter = new Deleter();
      const file: FileInfo = {
        path: '/root/unknown.md',
        name: 'unknown.md',
        extension: '.md',
        size: 100,
        modifiedTime: new Date(),
      };

      deleter.flagUnknownFile(file);

      const unknownFiles = deleter.getUnknownFiles();
      expect(unknownFiles).toHaveLength(1);
      expect(unknownFiles[0]).toEqual(file);
    });

    it('should flag multiple unknown files', () => {
      const deleter = new Deleter();
      const files: FileInfo[] = [
        {
          path: '/root/unknown1.md',
          name: 'unknown1.md',
          extension: '.md',
          size: 100,
          modifiedTime: new Date(),
        },
        {
          path: '/root/unknown2.txt',
          name: 'unknown2.txt',
          extension: '.txt',
          size: 200,
          modifiedTime: new Date(),
        },
        {
          path: '/root/unknown3.log',
          name: 'unknown3.log',
          extension: '.log',
          size: 300,
          modifiedTime: new Date(),
        },
      ];

      for (const file of files) {
        deleter.flagUnknownFile(file);
      }

      const unknownFiles = deleter.getUnknownFiles();
      expect(unknownFiles).toHaveLength(3);
      expect(unknownFiles).toEqual(files);
    });

    it('should return empty array when no files are flagged', () => {
      const deleter = new Deleter();
      const unknownFiles = deleter.getUnknownFiles();
      expect(unknownFiles).toHaveLength(0);
    });
  });

  describe('verifyDeletion', () => {
    it('should return true when all deletions succeed', () => {
      const deleter = new Deleter();
      const results = [
        {
          path: '/root/file1.md',
          category: FileCategory.TEMPORARY_SUMMARY,
          success: true,
        },
        {
          path: '/root/file2.log',
          category: FileCategory.TEMPORARY_LOG,
          success: true,
        },
      ];

      expect(deleter.verifyDeletion(results)).toBe(true);
    });

    it('should return false when any deletion fails', () => {
      const deleter = new Deleter();
      const results = [
        {
          path: '/root/file1.md',
          category: FileCategory.TEMPORARY_SUMMARY,
          success: true,
        },
        {
          path: '/root/file2.log',
          category: FileCategory.TEMPORARY_LOG,
          success: false,
          error: 'Permission denied',
        },
      ];

      expect(deleter.verifyDeletion(results)).toBe(false);
    });

    it('should return true for empty results', () => {
      const deleter = new Deleter();
      expect(deleter.verifyDeletion([])).toBe(true);
    });
  });
});

/**
 * Property-Based Test: Deletion Safety - Backup Before Delete
 * Feature: project-cleanup, Property 8: Deletion Safety - Backup Before Delete
 * Validates: Requirements 3.1
 * 
 * Property: For any deletion operation, a backup list containing all files 
 * to be deleted should be created and persisted before any file is actually removed.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { Deleter } from '../Deleter';
import { FileInfo, FileCategory } from '../types';

describe('Property 8: Deletion Safety - Backup Before Delete', () => {
  const testBackupPath = '.kiro/test-cleanup-backup.json';

  beforeEach(() => {
    // Clean up test backup file
    if (fs.existsSync(testBackupPath)) {
      fs.unlinkSync(testBackupPath);
    }
  });

  afterEach(() => {
    // Clean up test backup file
    if (fs.existsSync(testBackupPath)) {
      fs.unlinkSync(testBackupPath);
    }
  });

  it('should create backup file before any deletion operation', () => {
    // Generator for file info with valid dates
    const fileInfoArb = fc.record({
      path: fc.string({ minLength: 1, maxLength: 50 }).map(s => `/tmp/test-${s}.md`),
      name: fc.string({ minLength: 1, maxLength: 30 }).map(s => `${s}.md`),
      extension: fc.constant('.md'),
      size: fc.integer({ min: 0, max: 1000000 }),
      modifiedTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
    });

    fc.assert(
      fc.property(
        fc.array(fileInfoArb, { minLength: 1, maxLength: 20 }),
        (files: FileInfo[]) => {
          const deleter = new Deleter(testBackupPath);

          // Create backup
          deleter.createDeletionBackup(files);

          // Verify backup file exists
          expect(fs.existsSync(testBackupPath)).toBe(true);

          // Verify backup contains all files
          const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
          const backup = JSON.parse(backupContent);

          expect(backup.files).toHaveLength(files.length);
          expect(backup.timestamp).toBeDefined();

          // Verify each file is in the backup
          for (let i = 0; i < files.length; i++) {
            expect(backup.files[i].path).toBe(files[i].path);
            expect(backup.files[i].name).toBe(files[i].name);
            expect(backup.files[i].extension).toBe(files[i].extension);
            expect(backup.files[i].size).toBe(files[i].size);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist backup before attempting any file deletion', () => {
    // Generator for temporary files with valid dates
    const tempFileArb = fc.record({
      path: fc.string({ minLength: 1, maxLength: 50 }).map(s => path.join(__dirname, `test-temp-${s}.md`)),
      name: fc.string({ minLength: 1, maxLength: 30 }).map(s => `TASK_${s}_SUMMARY.md`),
      extension: fc.constant('.md'),
      size: fc.integer({ min: 0, max: 1000 }),
      modifiedTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
    });

    fc.assert(
      fc.property(
        fc.array(tempFileArb, { minLength: 1, maxLength: 10 }),
        (files: FileInfo[]) => {
          const deleter = new Deleter(testBackupPath);

          // Create backup
          deleter.createDeletionBackup(files);

          // Verify backup exists BEFORE attempting deletion
          const backupExistsBeforeDeletion = fs.existsSync(testBackupPath);
          expect(backupExistsBeforeDeletion).toBe(true);

          // Verify backup is readable and valid
          const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
          const backup = JSON.parse(backupContent);
          expect(backup.files).toHaveLength(files.length);

          // Now attempt deletion (will fail because files don't exist, but that's ok)
          // The important thing is backup was created first
          for (const file of files) {
            deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);
          }

          // Backup should still exist after deletion attempts
          expect(fs.existsSync(testBackupPath)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include complete file metadata in backup', () => {
    const fileInfoArb = fc.record({
      path: fc.string({ minLength: 1, maxLength: 50 }).map(s => `/root/${s}.log`),
      name: fc.string({ minLength: 1, maxLength: 30 }).map(s => `${s}.log`),
      extension: fc.constant('.log'),
      size: fc.integer({ min: 0, max: 10000000 }),
      modifiedTime: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
    });

    fc.assert(
      fc.property(
        fc.array(fileInfoArb, { minLength: 1, maxLength: 15 }),
        (files: FileInfo[]) => {
          const deleter = new Deleter(testBackupPath);

          deleter.createDeletionBackup(files);

          const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
          const backup = JSON.parse(backupContent);

          // Verify all metadata is preserved
          for (let i = 0; i < files.length; i++) {
            const backupFile = backup.files[i];
            const originalFile = files[i];

            expect(backupFile.path).toBe(originalFile.path);
            expect(backupFile.name).toBe(originalFile.name);
            expect(backupFile.extension).toBe(originalFile.extension);
            expect(backupFile.size).toBe(originalFile.size);
            expect(backupFile.modifiedTime).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

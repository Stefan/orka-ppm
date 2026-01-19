/**
 * Property-Based Test: Unknown File Flagging
 * Feature: project-cleanup, Property 10: Unknown File Flagging
 * Validates: Requirements 3.3
 * 
 * Property: For any file that does not match any known category pattern, 
 * the system should flag it in the UNKNOWN category for manual review 
 * and should not delete it.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { Deleter } from '../Deleter';
import { FileInfo, FileCategory } from '../types';

describe('Property 10: Unknown File Flagging', () => {
  const testDir = path.join(__dirname, 'test-unknown');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(testDir);
    }
  });

  it('should flag unknown files without deleting them', () => {
    // Generator for unknown files (files that don't match any pattern)
    const unknownFileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\'))
        .map(s => `unknown-${s}.md`),
    }).map(({ name }) => ({
      path: path.join(testDir, name),
      name,
      extension: '.md',
      size: 100,
      modifiedTime: new Date(),
    }));

    fc.assert(
      fc.property(unknownFileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Create the file
        fs.writeFileSync(file.path, 'test content', 'utf-8');

        // Flag the unknown file
        deleter.flagUnknownFile(file);

        // Verify file is flagged
        const unknownFiles = deleter.getUnknownFiles();
        expect(unknownFiles).toContainEqual(file);

        // Verify file still exists (not deleted)
        expect(fs.existsSync(file.path)).toBe(true);

        // Clean up
        fs.unlinkSync(file.path);
      }),
      { numRuns: 100 }
    );
  });

  it('should not delete files in UNKNOWN category', () => {
    const unknownFileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\'))
        .map(s => `random-${s}.txt`),
    }).map(({ name }) => ({
      path: path.join(testDir, name),
      name,
      extension: '.txt',
      size: 100,
      modifiedTime: new Date(),
    }));

    fc.assert(
      fc.property(unknownFileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Create the file
        fs.writeFileSync(file.path, 'test content', 'utf-8');

        // Attempt to delete with UNKNOWN category
        const result = deleter.deleteFile(file, FileCategory.UNKNOWN);

        // Should fail because UNKNOWN is not a deletable category
        expect(result.success).toBe(false);
        expect(result.error).toContain('not deletable');

        // File should still exist
        expect(fs.existsSync(file.path)).toBe(true);

        // Clean up
        fs.unlinkSync(file.path);
      }),
      { numRuns: 100 }
    );
  });

  it('should accumulate multiple unknown files', () => {
    const unknownFilesArb = fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => !s.includes('/') && !s.includes('\\'))
          .map(s => `unknown-${s}.log`),
      }).map(({ name }) => ({
        path: path.join(testDir, name),
        name,
        extension: '.log',
        size: 100,
        modifiedTime: new Date(),
      })),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(unknownFilesArb, (files: FileInfo[]) => {
        const deleter = new Deleter();

        // Flag all files as unknown
        for (const file of files) {
          deleter.flagUnknownFile(file);
        }

        // Verify all files are flagged
        const unknownFiles = deleter.getUnknownFiles();
        expect(unknownFiles).toHaveLength(files.length);

        for (const file of files) {
          expect(unknownFiles).toContainEqual(file);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve unknown file list across operations', () => {
    const unknownFileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\'))
        .map(s => `preserve-${s}.json`),
    }).map(({ name }) => ({
      path: path.join(testDir, name),
      name,
      extension: '.json',
      size: 100,
      modifiedTime: new Date(),
    }));

    fc.assert(
      fc.property(unknownFileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Flag the file
        deleter.flagUnknownFile(file);

        // Verify it's in the list
        let unknownFiles = deleter.getUnknownFiles();
        expect(unknownFiles).toHaveLength(1);
        expect(unknownFiles[0]).toEqual(file);

        // Get the list again - should still be there
        unknownFiles = deleter.getUnknownFiles();
        expect(unknownFiles).toHaveLength(1);
        expect(unknownFiles[0]).toEqual(file);
      }),
      { numRuns: 100 }
    );
  });

  it('should return a copy of unknown files list', () => {
    const unknownFileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\'))
        .map(s => `copy-${s}.csv`),
    }).map(({ name }) => ({
      path: path.join(testDir, name),
      name,
      extension: '.csv',
      size: 100,
      modifiedTime: new Date(),
    }));

    fc.assert(
      fc.property(unknownFileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Flag the file
        deleter.flagUnknownFile(file);

        // Get the list
        const unknownFiles1 = deleter.getUnknownFiles();
        const unknownFiles2 = deleter.getUnknownFiles();

        // Should be equal but not the same reference
        expect(unknownFiles1).toEqual(unknownFiles2);
        expect(unknownFiles1).not.toBe(unknownFiles2);

        // Modifying one should not affect the other
        unknownFiles1.push({
          path: '/fake/path.txt',
          name: 'fake.txt',
          extension: '.txt',
          size: 0,
          modifiedTime: new Date(),
        });

        expect(unknownFiles1.length).toBe(2);
        expect(unknownFiles2.length).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

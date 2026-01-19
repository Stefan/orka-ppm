/**
 * Property-Based Test: Deletion Safety - Pattern Verification
 * Feature: project-cleanup, Property 9: Deletion Safety - Pattern Verification
 * Validates: Requirements 3.2, 3.5
 * 
 * Property: For any file that is deleted, it must match at least one temporary 
 * file pattern and have an allowed extension (.md, .log, .txt, .json, .html, .csv).
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { Deleter } from '../Deleter';
import { FileInfo, FileCategory } from '../types';

describe('Property 9: Deletion Safety - Pattern Verification', () => {
  const testDir = path.join(__dirname, 'test-deletion');

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
        fs.unlinkSync(path.join(testDir, file));
      }
      fs.rmdirSync(testDir);
    }
  });

  it('should only delete files with allowed extensions', () => {
    const allowedExtensions = ['.md', '.log', '.txt', '.json', '.html', '.csv'];
    const disallowedExtensions = ['.ts', '.js', '.py', '.exe', '.sh', '.sql'];

    const fileArb = fc.record({
      extension: fc.oneof(
        fc.constantFrom(...allowedExtensions),
        fc.constantFrom(...disallowedExtensions)
      ),
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\') && !s.includes('\0'))
        .map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')),
    }).map(({ extension, name }) => {
      const fileName = `${name}${extension}`;
      const filePath = path.join(testDir, fileName);
      return {
        path: filePath,
        name: fileName,
        extension,
        size: 100,
        modifiedTime: new Date(),
      };
    });

    fc.assert(
      fc.property(fileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Create the file
        fs.writeFileSync(file.path, 'test content', 'utf-8');

        // Attempt deletion with TEMPORARY_SUMMARY category
        const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

        const isAllowedExtension = allowedExtensions.includes(file.extension);

        if (isAllowedExtension) {
          // Should succeed for allowed extensions
          expect(result.success).toBe(true);
          expect(fs.existsSync(file.path)).toBe(false);
        } else {
          // Should fail for disallowed extensions
          expect(result.success).toBe(false);
          expect(result.error).toContain('not allowed for deletion');
          expect(fs.existsSync(file.path)).toBe(true);
          // Clean up
          fs.unlinkSync(file.path);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should only delete files in deletable categories', () => {
    const deletableCategories = [
      FileCategory.TEMPORARY_SUMMARY,
      FileCategory.TEMPORARY_LOG,
    ];

    const nonDeletableCategories = [
      FileCategory.ESSENTIAL,
      FileCategory.TRANSLATION_WORK,
      FileCategory.PERFORMANCE_REPORT,
      FileCategory.SQL_REVIEW,
      FileCategory.UNKNOWN,
    ];

    const fileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\') && !s.includes('\0'))
        .map(s => `${s.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`),
      category: fc.oneof(
        fc.constantFrom(...deletableCategories),
        fc.constantFrom(...nonDeletableCategories)
      ),
    }).map(({ name, category }) => {
      const filePath = path.join(testDir, name);
      return {
        file: {
          path: filePath,
          name,
          extension: '.md',
          size: 100,
          modifiedTime: new Date(),
        },
        category,
      };
    });

    fc.assert(
      fc.property(fileArb, ({ file, category }) => {
        const deleter = new Deleter();

        // Create the file
        fs.writeFileSync(file.path, 'test content', 'utf-8');

        // Attempt deletion
        const result = deleter.deleteFile(file, category);

        const isDeletableCategory = deletableCategories.includes(category);

        if (isDeletableCategory) {
          // Should succeed for deletable categories
          expect(result.success).toBe(true);
          expect(fs.existsSync(file.path)).toBe(false);
        } else {
          // Should fail for non-deletable categories
          expect(result.success).toBe(false);
          expect(result.error).toContain('not deletable');
          expect(fs.existsSync(file.path)).toBe(true);
          // Clean up
          fs.unlinkSync(file.path);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should verify both category and extension before deletion', () => {
    const allowedExtensions = ['.md', '.log', '.txt', '.json', '.html', '.csv'];
    const disallowedExtensions = ['.ts', '.js', '.py'];

    const deletableCategories = [
      FileCategory.TEMPORARY_SUMMARY,
      FileCategory.TEMPORARY_LOG,
    ];

    const nonDeletableCategories = [
      FileCategory.ESSENTIAL,
      FileCategory.UNKNOWN,
    ];

    const fileArb = fc.record({
      extension: fc.oneof(
        fc.constantFrom(...allowedExtensions),
        fc.constantFrom(...disallowedExtensions)
      ),
      category: fc.oneof(
        fc.constantFrom(...deletableCategories),
        fc.constantFrom(...nonDeletableCategories)
      ),
      name: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('/') && !s.includes('\\') && !s.includes('\0'))
        .map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')),
    }).map(({ extension, category, name }) => {
      const fileName = `${name}${extension}`;
      const filePath = path.join(testDir, fileName);
      return {
        file: {
          path: filePath,
          name: fileName,
          extension,
          size: 100,
          modifiedTime: new Date(),
        },
        category,
      };
    });

    fc.assert(
      fc.property(fileArb, ({ file, category }) => {
        const deleter = new Deleter();

        // Create the file
        fs.writeFileSync(file.path, 'test content', 'utf-8');

        // Attempt deletion
        const result = deleter.deleteFile(file, category);

        const isAllowedExtension = allowedExtensions.includes(file.extension);
        const isDeletableCategory = deletableCategories.includes(category);

        // Should only succeed if BOTH conditions are met
        if (isAllowedExtension && isDeletableCategory) {
          expect(result.success).toBe(true);
          expect(fs.existsSync(file.path)).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(fs.existsSync(file.path)).toBe(true);
          // Clean up
          fs.unlinkSync(file.path);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should not delete files that do not exist', () => {
    const fileArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 }).map(s => `nonexistent-${s}.md`),
    }).map(({ name }) => ({
      path: path.join(testDir, name),
      name,
      extension: '.md',
      size: 100,
      modifiedTime: new Date(),
    }));

    fc.assert(
      fc.property(fileArb, (file: FileInfo) => {
        const deleter = new Deleter();

        // Do NOT create the file
        expect(fs.existsSync(file.path)).toBe(false);

        // Attempt deletion
        const result = deleter.deleteFile(file, FileCategory.TEMPORARY_SUMMARY);

        // Should fail because file doesn't exist
        expect(result.success).toBe(false);
        expect(result.error).toContain('does not exist');
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property-Based Tests for SQL Reference Checking
 * 
 * Feature: project-cleanup, Property 14: SQL File Reference Checking
 * Validates: Requirements 7.2, 7.3, 7.4
 * 
 * These tests verify that SQL files are correctly categorized based on whether
 * they are referenced in essential documentation.
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Categorizer } from '../Categorizer';
import { FileScanner } from '../FileScanner';
import { SqlReferenceChecker } from '../SqlReferenceChecker';
import { FileInfo, FileCategory } from '../types';

describe('SQL Reference Checking - Property-Based Tests', () => {
  let tempDir: string;
  let categorizer: Categorizer;
  let scanner: FileScanner;
  let sqlChecker: SqlReferenceChecker;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
    scanner = new FileScanner(tempDir);
    sqlChecker = new SqlReferenceChecker(tempDir);
    categorizer = new Categorizer(scanner, sqlChecker);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Generator for SQL file names
   */
  const sqlFileNameArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !s.includes('/') && !s.includes('\\'))
    .map(s => `${s.replace(/[^a-zA-Z0-9_-]/g, '_')}.sql`);

  /**
   * Generator for documentation content that may or may not reference SQL files
   */
  const docContentArb = fc.oneof(
    // Content with SQL file reference
    fc.tuple(sqlFileNameArb, fc.lorem()).map(([sqlFile, text]) => 
      `${text}\n\nRun the setup script: ${sqlFile}\n\n${text}`
    ),
    // Content without SQL file reference
    fc.lorem(),
    // Content with partial SQL file name (should not match)
    fc.tuple(sqlFileNameArb, fc.lorem()).map(([sqlFile, text]) => 
      `${text}\n\nRun the setup script: ${sqlFile.replace('.sql', '')}\n\n${text}`
    ),
  );

  /**
   * Helper to create a documentation file with content
   */
  const createDocFile = (filename: string, content: string): void => {
    fs.writeFileSync(path.join(tempDir, filename), content, 'utf-8');
  };

  /**
   * Helper to create a FileInfo object for a SQL file
   */
  const createSqlFileInfo = (filename: string): FileInfo => ({
    path: path.join(tempDir, filename),
    name: filename,
    extension: '.sql',
    size: 1024,
    modifiedTime: new Date(),
  });

  // Feature: project-cleanup, Property 14: SQL File Reference Checking
  describe('Property 14: SQL File Reference Checking', () => {
    it('should categorize referenced SQL files as ESSENTIAL', () => {
      fc.assert(
        fc.property(sqlFileNameArb, fc.lorem(), (sqlFileName, docText) => {
          // Create documentation that references the SQL file
          const docContent = `${docText}\n\nRun this SQL script: ${sqlFileName}\n\n${docText}`;
          createDocFile('DEPLOYMENT.md', docContent);

          const file = createSqlFileInfo(sqlFileName);
          const category = categorizer.categorizeFile(file);

          // Property: SQL files referenced in documentation should be ESSENTIAL
          expect(category).toBe(FileCategory.ESSENTIAL);
        }),
        { numRuns: 100 }
      );
    });

    it('should categorize unreferenced SQL files as SQL_REVIEW', () => {
      fc.assert(
        fc.property(sqlFileNameArb, fc.lorem(), (sqlFileName, docText) => {
          // Create documentation that does NOT reference the SQL file
          createDocFile('DEPLOYMENT.md', docText);

          const file = createSqlFileInfo(sqlFileName);
          const category = categorizer.categorizeFile(file);

          // Property: SQL files NOT referenced in documentation should be SQL_REVIEW
          expect(category).toBe(FileCategory.SQL_REVIEW);
        }),
        { numRuns: 100 }
      );
    });

    it('should check multiple documentation files for SQL references', () => {
      fc.assert(
        fc.property(
          sqlFileNameArb,
          fc.lorem(),
          fc.lorem(),
          fc.constantFrom('DEPLOYMENT.md', 'AUTH_SETUP_GUIDE.md', 'TESTING_GUIDE.md'),
          (sqlFileName, docText1, docText2, docFile) => {
            // Create one doc with reference, one without
            createDocFile('DEPLOYMENT.md', docText1);
            createDocFile('AUTH_SETUP_GUIDE.md', docText2);
            
            // Add reference to the selected doc file
            const contentWithRef = `${docText1}\n\nExecute ${sqlFileName} to set up the database.\n\n${docText2}`;
            createDocFile(docFile, contentWithRef);

            const file = createSqlFileInfo(sqlFileName);
            const category = categorizer.categorizeFile(file);

            // Property: SQL file should be ESSENTIAL if referenced in ANY essential doc
            expect(category).toBe(FileCategory.ESSENTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive when checking SQL file references', () => {
      fc.assert(
        fc.property(
          sqlFileNameArb,
          fc.lorem(),
          fc.constantFrom('upper', 'lower', 'mixed'),
          (sqlFileName, docText, caseType) => {
            // Transform the SQL filename in the documentation
            let docSqlName = sqlFileName;
            if (caseType === 'upper') {
              docSqlName = sqlFileName.toUpperCase();
            } else if (caseType === 'lower') {
              docSqlName = sqlFileName.toLowerCase();
            } else {
              // Mixed case - alternate upper/lower
              docSqlName = sqlFileName.split('').map((c, i) => 
                i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }

            const docContent = `${docText}\n\nRun: ${docSqlName}\n\n${docText}`;
            createDocFile('DEPLOYMENT.md', docContent);

            const file = createSqlFileInfo(sqlFileName);
            const category = categorizer.categorizeFile(file);

            // Property: Reference checking should be case-insensitive
            expect(category).toBe(FileCategory.ESSENTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not match partial SQL file names', () => {
      fc.assert(
        fc.property(sqlFileNameArb, fc.lorem(), (sqlFileName, docText) => {
          // Create documentation with only partial filename (without .sql extension)
          const partialName = sqlFileName.replace('.sql', '');
          const docContent = `${docText}\n\nRun: ${partialName}\n\n${docText}`;
          createDocFile('DEPLOYMENT.md', docContent);

          const file = createSqlFileInfo(sqlFileName);
          const category = categorizer.categorizeFile(file);

          // Property: Partial matches should not count as references
          // The file should be SQL_REVIEW, not ESSENTIAL
          expect(category).toBe(FileCategory.SQL_REVIEW);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle SQL files when no documentation exists', () => {
      fc.assert(
        fc.property(sqlFileNameArb, (sqlFileName) => {
          // Don't create any documentation files
          const file = createSqlFileInfo(sqlFileName);
          const category = categorizer.categorizeFile(file);

          // Property: SQL files with no docs should be SQL_REVIEW
          expect(category).toBe(FileCategory.SQL_REVIEW);
        }),
        { numRuns: 100 }
      );
    });

    it('should consistently categorize the same SQL file', () => {
      fc.assert(
        fc.property(sqlFileNameArb, fc.lorem(), fc.boolean(), (sqlFileName, docText, hasReference) => {
          // Create documentation with or without reference
          const docContent = hasReference 
            ? `${docText}\n\nRun: ${sqlFileName}\n\n${docText}`
            : docText;
          createDocFile('DEPLOYMENT.md', docContent);

          const file = createSqlFileInfo(sqlFileName);
          
          // Categorize multiple times
          const category1 = categorizer.categorizeFile(file);
          const category2 = categorizer.categorizeFile(file);
          const category3 = categorizer.categorizeFile(file);

          // Property: Categorization should be deterministic
          expect(category1).toBe(category2);
          expect(category2).toBe(category3);
          
          // Property: Category should match reference status
          if (hasReference) {
            expect(category1).toBe(FileCategory.ESSENTIAL);
          } else {
            expect(category1).toBe(FileCategory.SQL_REVIEW);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle SQL files with special characters in names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => !s.includes('/') && !s.includes('\\'))
            .map(s => `${s.replace(/[^a-zA-Z0-9_.-]/g, '_')}.sql`),
          fc.lorem(),
          (sqlFileName, docText) => {
            const docContent = `${docText}\n\nExecute: ${sqlFileName}\n\n${docText}`;
            createDocFile('AUTH_SETUP_GUIDE.md', docContent);

            const file = createSqlFileInfo(sqlFileName);
            const category = categorizer.categorizeFile(file);

            // Property: SQL files with special chars should still be detected
            expect(category).toBe(FileCategory.ESSENTIAL);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize SQL reference check over SQL_REVIEW pattern', () => {
      fc.assert(
        fc.property(sqlFileNameArb, fc.lorem(), (sqlFileName, docText) => {
          // Create documentation that references the SQL file
          const docContent = `${docText}\n\nDatabase setup: ${sqlFileName}\n\n${docText}`;
          createDocFile('DEPLOYMENT.md', docContent);

          const file = createSqlFileInfo(sqlFileName);
          const category = categorizer.categorizeFile(file);

          // Property: Referenced SQL files should be ESSENTIAL, not SQL_REVIEW
          // This tests that the reference check happens before pattern matching
          expect(category).toBe(FileCategory.ESSENTIAL);
          expect(category).not.toBe(FileCategory.SQL_REVIEW);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple SQL files with different reference statuses', () => {
      fc.assert(
        fc.property(
          fc.array(sqlFileNameArb, { minLength: 2, maxLength: 10 }),
          fc.lorem(),
          fc.integer({ min: 0, max: 100 }),
          (sqlFileNames, docText, refIndex) => {
            // Make SQL filenames unique
            const uniqueSqlFiles = Array.from(new Set(sqlFileNames));
            if (uniqueSqlFiles.length < 2) return; // Skip if not enough unique files

            // Reference only one SQL file in documentation
            const referencedFile = uniqueSqlFiles[refIndex % uniqueSqlFiles.length];
            const docContent = `${docText}\n\nRun: ${referencedFile}\n\n${docText}`;
            createDocFile('DEPLOYMENT.md', docContent);

            // Check all SQL files
            // SqlReferenceChecker uses case-insensitive matching, so multiple filenames can match the same doc reference
            const isReferenced = (name: string) =>
              name === referencedFile || name.toLowerCase() === referencedFile.toLowerCase();

            for (const sqlFileName of uniqueSqlFiles) {
              const file = createSqlFileInfo(sqlFileName);
              const category = categorizer.categorizeFile(file);

              // Property: Referenced file (or case-insensitive match) is ESSENTIAL; others are SQL_REVIEW
              if (isReferenced(sqlFileName)) {
                expect(category).toBe(FileCategory.ESSENTIAL);
              } else {
                expect(category).toBe(FileCategory.SQL_REVIEW);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
